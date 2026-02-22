package cmd

import (
	"fmt"
	"os"
	"runtime/debug"

	"github.com/maxcelos/wpmax/internal/config"
	"github.com/spf13/cobra"
)

// Version is set via ldflags at build time by GoReleaser.
// Falls back to Go module info (set automatically by go install).
var Version = ""

func getVersion() string {
	if Version != "" {
		return Version
	}
	if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" {
		return info.Main.Version
	}
	return "dev"
}

var rootCmd = &cobra.Command{
	Use:   "wpmax",
	Short: "Docker-based WordPress site manager",
	Long:  "wpmax creates and manages local WordPress development sites using Docker containers with HTTPS via mkcert.",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return config.EnsureDirs()
	},
}

func Execute() {
	rootCmd.Version = getVersion()
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
