package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/maxcelos/wpmax/internal/compose"
	"github.com/maxcelos/wpmax/internal/config"
	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/plugins"
	"github.com/maxcelos/wpmax/internal/proxy"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/maxcelos/wpmax/internal/wpcli"
	"github.com/spf13/cobra"
)

var (
	flagPlugins     string
	flagThemes      string
	flagSkipPlugins bool
	flagSkipThemes  bool
	flagYes         bool
)

func init() {
	createCmd.Flags().StringVar(&flagPlugins, "plugins", "", "Comma-separated plugin slugs/filenames (non-interactive)")
	createCmd.Flags().StringVar(&flagThemes, "themes", "", "Comma-separated theme slugs/filenames (non-interactive)")
	createCmd.Flags().BoolVar(&flagSkipPlugins, "skip-plugins", false, "Skip plugin selection")
	createCmd.Flags().BoolVar(&flagSkipThemes, "skip-themes", false, "Skip theme selection")
	createCmd.Flags().BoolVarP(&flagYes, "yes", "y", false, "Skip confirmation prompts")
	rootCmd.AddCommand(createCmd)
}

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

var createCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create a new WordPress site",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]

		// Validate name
		if !slugRegex.MatchString(name) {
			return fmt.Errorf("invalid site name %q: must be lowercase alphanumeric with hyphens", name)
		}

		// Check not already registered
		if registry.Exists(name) {
			return fmt.Errorf("site %q already exists", name)
		}

		// Check prerequisites
		if !docker.IsRunning() {
			return fmt.Errorf("Docker is not running. Please start Docker and try again.")
		}
		if !docker.NetworkExists("wpmax") {
			return fmt.Errorf("wpmax network not found. Run 'wpmax init' first.")
		}
		if !proxy.IsRunning() {
			return fmt.Errorf("proxy is not running. Run 'wpmax init' first.")
		}

		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("loading config: %w", err)
		}

		// Plugin selection
		var selectedLocalPlugins []plugins.LocalItem
		var selectedPublicPlugins []string
		if !flagSkipPlugins {
			if flagPlugins != "" {
				selectedPublicPlugins = splitCSV(flagPlugins)
			} else {
				localPlugins, err := plugins.ScanLocalZips(cfg.DefaultPluginsPath)
				if err != nil {
					return fmt.Errorf("scanning local plugins: %w", err)
				}
				selectedLocalPlugins, selectedPublicPlugins, err = plugins.PromptSelection(
					"Select plugins to install",
					localPlugins,
					cfg.PublicPlugins,
				)
				if err != nil {
					return fmt.Errorf("plugin selection: %w", err)
				}
			}
		}

		// Theme selection
		var selectedLocalThemes []plugins.LocalItem
		var selectedPublicThemes []string
		if !flagSkipThemes {
			if flagThemes != "" {
				selectedPublicThemes = splitCSV(flagThemes)
			} else {
				localThemes, err := plugins.ScanLocalZips(cfg.DefaultThemesPath)
				if err != nil {
					return fmt.Errorf("scanning local themes: %w", err)
				}
				selectedLocalThemes, selectedPublicThemes, err = plugins.PromptSelection(
					"Select themes to install",
					localThemes,
					cfg.PublicThemes,
				)
				if err != nil {
					return fmt.Errorf("theme selection: %w", err)
				}
			}
		}

		// Determine site directory
		cwd, err := os.Getwd()
		if err != nil {
			return err
		}
		siteDir := filepath.Join(cwd, name)

		// Rollback stack
		var rollback []func()
		doRollback := func() {
			for i := len(rollback) - 1; i >= 0; i-- {
				rollback[i]()
			}
		}

		// Create directory
		fmt.Printf("Creating site %q...\n", name)
		if err := os.MkdirAll(siteDir, 0755); err != nil {
			return fmt.Errorf("creating directory: %w", err)
		}
		rollback = append(rollback, func() {
			fmt.Println("Rolling back: removing directory...")
			os.RemoveAll(siteDir)
		})

		// Create wp-content directory
		if err := os.MkdirAll(filepath.Join(siteDir, "wp-content"), 0755); err != nil {
			doRollback()
			return fmt.Errorf("creating wp-content directory: %w", err)
		}

		// Generate docker-compose.yml
		composeData := compose.SiteComposeData{
			Name:       name,
			DBUser:     cfg.DBUser,
			DBPassword: cfg.DBPassword,
		}
		if cfg.DefaultPluginsPath != "" {
			composeData.PluginsMount = cfg.DefaultPluginsPath
		}
		if cfg.DefaultThemesPath != "" {
			composeData.ThemesMount = cfg.DefaultThemesPath
		}

		if err := compose.WriteTo(siteDir, composeData); err != nil {
			doRollback()
			return fmt.Errorf("generating docker-compose.yml: %w", err)
		}

		// Start containers
		fmt.Println("Starting containers...")
		project := docker.ProjectName(name)
		if err := docker.ComposeUp(project, siteDir); err != nil {
			doRollback()
			return fmt.Errorf("starting containers: %w", err)
		}
		rollback = append(rollback, func() {
			fmt.Println("Rolling back: stopping containers...")
			docker.ComposeDown(project, siteDir, true)
		})

		// Write nginx conf and reload proxy
		if err := proxy.AddSiteConf(name); err != nil {
			doRollback()
			return fmt.Errorf("adding nginx config: %w", err)
		}
		rollback = append(rollback, func() {
			fmt.Println("Rolling back: removing nginx config...")
			proxy.RemoveSiteConf(name)
			proxy.Reload()
		})

		if err := proxy.Reload(); err != nil {
			doRollback()
			return fmt.Errorf("reloading proxy: %w", err)
		}

		// Install WordPress
		siteURL := fmt.Sprintf("https://%s.wpmax.localhost", name)
		title := strings.ReplaceAll(name, "-", " ")
		title = strings.Title(title)

		fmt.Println("Installing WordPress...")
		if _, err := wpcli.Run(name, siteDir,
			"core", "install",
			"--url="+siteURL,
			"--title="+title,
			"--admin_user="+cfg.AdminUser,
			"--admin_password="+cfg.AdminPassword,
			"--admin_email="+cfg.AdminEmail,
			"--skip-email",
		); err != nil {
			doRollback()
			return fmt.Errorf("installing WordPress: %w", err)
		}

		// Clean up default plugins
		fmt.Println("Removing default plugins...")
		wpcli.Run(name, siteDir, "plugin", "delete", "hello")
		wpcli.Run(name, siteDir, "plugin", "delete", "akismet")

		// Clean up inactive default themes (keep only the active one)
		fmt.Println("Removing inactive default themes...")
		if themeList, err := wpcli.Run(name, siteDir, "theme", "list", "--status=inactive", "--field=name"); err == nil {
			for _, t := range strings.Split(strings.TrimSpace(themeList), "\n") {
				t = strings.TrimSpace(t)
				if t != "" {
					wpcli.Run(name, siteDir, "theme", "delete", t)
				}
			}
		}

		// Install plugins
		for _, p := range selectedLocalPlugins {
			fmt.Printf("Installing plugin: %s...\n", p.Name)
			if _, err := wpcli.Run(name, siteDir,
				"plugin", "install", "/mnt/plugins/"+p.Filename, "--activate",
			); err != nil {
				fmt.Printf("Warning: failed to install plugin %s: %v\n", p.Name, err)
			}
		}
		for _, slug := range selectedPublicPlugins {
			fmt.Printf("Installing plugin: %s...\n", slug)
			if _, err := wpcli.Run(name, siteDir,
				"plugin", "install", slug, "--activate",
			); err != nil {
				fmt.Printf("Warning: failed to install plugin %s: %v\n", slug, err)
			}
		}

		// Install themes
		for _, t := range selectedLocalThemes {
			fmt.Printf("Installing theme: %s...\n", t.Name)
			if _, err := wpcli.Run(name, siteDir,
				"theme", "install", "/mnt/themes/"+t.Filename, "--activate",
			); err != nil {
				fmt.Printf("Warning: failed to install theme %s: %v\n", t.Name, err)
			}
		}
		for _, slug := range selectedPublicThemes {
			fmt.Printf("Installing theme: %s...\n", slug)
			if _, err := wpcli.Run(name, siteDir,
				"theme", "install", slug, "--activate",
			); err != nil {
				fmt.Printf("Warning: failed to install theme %s: %v\n", slug, err)
			}
		}

		// Register site
		if err := registry.Add(registry.Site{
			Name:      name,
			Path:      siteDir,
			URL:       siteURL,
			CreatedAt: time.Now(),
		}); err != nil {
			doRollback()
			return fmt.Errorf("registering site: %w", err)
		}

		// Success
		fmt.Println()
		fmt.Println("Site created successfully!")
		fmt.Printf("  URL:      %s\n", siteURL)
		fmt.Printf("  Admin:    %s/wp-admin\n", siteURL)
		fmt.Printf("  Username: %s\n", cfg.AdminUser)
		fmt.Printf("  Password: %s\n", cfg.AdminPassword)
		fmt.Printf("  Path:     %s\n", siteDir)

		return nil
	},
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
