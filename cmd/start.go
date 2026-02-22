package cmd

import (
	"fmt"

	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/proxy"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/spf13/cobra"
)

var startAll bool

func init() {
	startCmd.Flags().BoolVar(&startAll, "all", false, "Start all sites and the proxy")
	rootCmd.AddCommand(startCmd)
}

var startCmd = &cobra.Command{
	Use:   "start [name]",
	Short: "Start a stopped site",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if startAll {
			if !proxy.IsRunning() {
				fmt.Println("Starting proxy...")
				if err := proxy.Start(); err != nil {
					return fmt.Errorf("failed to start proxy: %w", err)
				}
			}
			sites, err := registry.List()
			if err != nil {
				return err
			}
			for _, site := range sites {
				if !docker.ContainerRunning(site.Name + "-wordpress") {
					fmt.Printf("Starting %s...\n", site.Name)
					if err := docker.ComposeUp(docker.ProjectName(site.Name), site.Path); err != nil {
						fmt.Printf("Warning: failed to start %s: %v\n", site.Name, err)
					}
				}
			}
			fmt.Println("Everything started.")
			return nil
		}

		if len(args) == 0 {
			return fmt.Errorf("provide a site name or use --all")
		}

		name := args[0]
		site, err := registry.Get(name)
		if err != nil {
			return err
		}

		fmt.Printf("Starting %s...\n", name)
		if err := docker.ComposeUp(docker.ProjectName(name), site.Path); err != nil {
			return fmt.Errorf("failed to start containers: %w", err)
		}

		// Ensure nginx conf exists and proxy is reloaded
		if err := proxy.AddSiteConf(name); err != nil {
			return fmt.Errorf("adding nginx config: %w", err)
		}
		if proxy.IsRunning() {
			if err := proxy.Reload(); err != nil {
				return fmt.Errorf("reloading proxy: %w", err)
			}
		}

		fmt.Printf("Site %s is running at %s\n", name, site.URL)
		return nil
	},
}