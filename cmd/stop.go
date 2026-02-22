package cmd

import (
	"fmt"

	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/proxy"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/spf13/cobra"
)

var stopAll bool

func init() {
	stopCmd.Flags().BoolVar(&stopAll, "all", false, "Stop all sites and the proxy")
	rootCmd.AddCommand(stopCmd)
}

var stopCmd = &cobra.Command{
	Use:   "stop [name]",
	Short: "Stop a running site (preserves data)",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if stopAll {
			sites, err := registry.List()
			if err != nil {
				return err
			}
			for _, site := range sites {
				if docker.ContainerRunning(site.Name + "-wordpress") {
					fmt.Printf("Stopping %s...\n", site.Name)
					if err := docker.ComposeStop(docker.ProjectName(site.Name), site.Path); err != nil {
						fmt.Printf("Warning: failed to stop %s: %v\n", site.Name, err)
					}
				}
			}
			if proxy.IsRunning() {
				fmt.Println("Stopping proxy...")
				if err := proxy.Stop(); err != nil {
					return fmt.Errorf("failed to stop proxy: %w", err)
				}
			}
			fmt.Println("Everything stopped.")
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

		fmt.Printf("Stopping %s...\n", name)
		if err := docker.ComposeStop(docker.ProjectName(name), site.Path); err != nil {
			return fmt.Errorf("failed to stop containers: %w", err)
		}

		fmt.Printf("Site %s stopped.\n", name)
		return nil
	},
}