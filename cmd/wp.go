package cmd

import (
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/maxcelos/wpmax/internal/wpcli"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(wpCmd)
}

var wpCmd = &cobra.Command{
	Use:                "wp <site> [wp-cli args...]",
	Short:              "Run a WP-CLI command on a site",
	Long:               "Passes arguments directly to WP-CLI running inside the site's container.",
	DisableFlagParsing: true,
	Args:               cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		site, err := registry.Get(name)
		if err != nil {
			return err
		}
		return wpcli.RunInteractive(site.Name, site.Path, args[1:]...)
	},
}
