package cmd

import (
	"fmt"
	"strings"

	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/maxcelos/wpmax/internal/wpcli"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(infoCmd)
}

var infoCmd = &cobra.Command{
	Use:   "info [name]",
	Short: "Show detailed info about a site",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		var name string
		if len(args) > 0 {
			name = args[0]
		} else {
			// Pick from list
			sites, err := registry.List()
			if err != nil {
				return err
			}
			if len(sites) == 0 {
				return fmt.Errorf("no sites found")
			}
			if len(sites) == 1 {
				name = sites[0].Name
			} else {
				return fmt.Errorf("please specify a site name")
			}
		}

		site, err := registry.Get(name)
		if err != nil {
			return err
		}

		status := "stopped"
		if docker.ContainerRunning(site.Name + "-wordpress") {
			status = "running"
		}

		fmt.Printf("Name:    %s\n", site.Name)
		fmt.Printf("URL:     %s\n", site.URL)
		fmt.Printf("Status:  %s\n", status)
		fmt.Printf("Path:    %s\n", site.Path)
		fmt.Printf("Created: %s\n", site.CreatedAt.Format("2006-01-02 15:04:05"))

		if status == "running" {
			// Query WP-CLI for additional info
			if version, err := wpcli.Run(site.Name, site.Path, "core", "version"); err == nil {
				fmt.Printf("WP Ver:  %s", strings.TrimSpace(version))
				fmt.Println()
			}
			if pluginList, err := wpcli.Run(site.Name, site.Path, "plugin", "list", "--status=active", "--field=name"); err == nil {
				p := strings.TrimSpace(pluginList)
				if p != "" {
					fmt.Printf("Plugins: %s\n", strings.ReplaceAll(p, "\n", ", "))
				}
			}
			if theme, err := wpcli.Run(site.Name, site.Path, "theme", "list", "--status=active", "--field=name"); err == nil {
				fmt.Printf("Theme:   %s\n", strings.TrimSpace(theme))
			}
		}

		return nil
	},
}
