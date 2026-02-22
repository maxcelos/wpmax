package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/proxy"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/spf13/cobra"
)

var (
	deleteYes      bool
	deleteDryRun   bool
	deleteKeepData bool
)

func init() {
	deleteCmd.Flags().BoolVarP(&deleteYes, "yes", "y", false, "Skip confirmation")
	deleteCmd.Flags().BoolVar(&deleteDryRun, "dry-run", false, "Show what would be deleted without doing it")
	deleteCmd.Flags().BoolVar(&deleteKeepData, "keep-data", false, "Keep Docker volumes (database data)")
	rootCmd.AddCommand(deleteCmd)
}

var deleteCmd = &cobra.Command{
	Use:     "delete <name>",
	Aliases: []string{"rm"},
	Short:   "Delete a site and its data",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		site, err := registry.Get(name)
		if err != nil {
			return err
		}

		if deleteDryRun {
			fmt.Printf("Would delete site: %s\n", name)
			fmt.Printf("  Stop and remove containers\n")
			if !deleteKeepData {
				fmt.Printf("  Remove Docker volumes\n")
			}
			fmt.Printf("  Remove nginx config\n")
			fmt.Printf("  Remove directory: %s\n", site.Path)
			fmt.Printf("  Remove from registry\n")
			return nil
		}

		if !deleteYes {
			fmt.Printf("Delete site %q? This will remove all containers, volumes, and files at %s.\n", name, site.Path)
			fmt.Print("Type the site name to confirm: ")
			reader := bufio.NewReader(os.Stdin)
			input, _ := reader.ReadString('\n')
			input = strings.TrimSpace(input)
			if input != name {
				return fmt.Errorf("confirmation failed, aborting")
			}
		}

		fmt.Printf("Deleting %s...\n", name)

		// Stop and remove containers
		removeVolumes := !deleteKeepData
		if err := docker.ComposeDown(docker.ProjectName(name), site.Path, removeVolumes); err != nil {
			fmt.Printf("Warning: failed to stop containers: %v\n", err)
		}

		// Remove nginx conf
		if err := proxy.RemoveSiteConf(name); err != nil {
			fmt.Printf("Warning: failed to remove nginx config: %v\n", err)
		}
		if proxy.IsRunning() {
			if err := proxy.Reload(); err != nil {
				fmt.Printf("Warning: failed to reload proxy: %v\n", err)
			}
		}

		// Remove directory
		if err := os.RemoveAll(site.Path); err != nil {
			fmt.Printf("Warning: failed to remove directory: %v\n", err)
		}

		// Remove from registry
		if err := registry.Remove(name); err != nil {
			return fmt.Errorf("failed to unregister site: %w", err)
		}

		fmt.Printf("Site %s deleted.\n", name)
		return nil
	},
}
