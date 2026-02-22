package cmd

import (
	"fmt"

	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(shellCmd)
}

var shellCmd = &cobra.Command{
	Use:   "shell <site>",
	Short: "Open a bash shell in a site's WordPress container",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		if _, err := registry.Get(name); err != nil {
			return err
		}

		container := name + "-wordpress"
		if !docker.ContainerRunning(container) {
			return fmt.Errorf("site %q is not running. Start it with: wpmax start %s", name, name)
		}

		return docker.ExecInteractive(container, "/bin/bash")
	},
}
