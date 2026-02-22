package cmd

import (
	"fmt"

	"github.com/maxcelos/wpmax/internal/certs"
	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/proxy"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(initCmd)
}

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize wpmax (mkcert, network, proxy)",
	Long:  "Sets up mkcert certificates, creates the Docker network, and starts the shared Nginx reverse proxy.",
	RunE: func(cmd *cobra.Command, args []string) error {
		// 1. Check Docker
		if !docker.IsRunning() {
			return fmt.Errorf("Docker is not running. Please start Docker and try again.")
		}
		fmt.Println("Docker is running.")

		// 2. Certificates
		fmt.Println("\nSetting up certificates...")
		if err := certs.EnsureCerts(); err != nil {
			return err
		}
		fmt.Println("Certificates ready.")

		// 3. Docker network
		if !docker.NetworkExists("wpmax") {
			fmt.Println("\nCreating wpmax network...")
			if err := docker.CreateNetwork("wpmax"); err != nil {
				return fmt.Errorf("failed to create network: %w", err)
			}
		}
		fmt.Println("Docker network ready.")

		// 4. Proxy
		fmt.Println("\nStarting proxy...")
		if err := proxy.Start(); err != nil {
			return fmt.Errorf("failed to start proxy: %w", err)
		}
		fmt.Println("Proxy is running.")

		fmt.Println("\nwpmax is ready! Create a site with: wpmax create <name>")
		return nil
	},
}
