package cmd

import (
	"fmt"

	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/maxcelos/wpmax/internal/wpcli"
	"github.com/spf13/cobra"
)

var (
	userUsername string
	userEmail    string
	userPassword string
	userRole     string
)

func init() {
	userAddCmd.Flags().StringVar(&userUsername, "username", "", "Username (required)")
	userAddCmd.Flags().StringVar(&userEmail, "email", "", "Email address")
	userAddCmd.Flags().StringVar(&userPassword, "password", "", "Password")
	userAddCmd.Flags().StringVar(&userRole, "role", "editor", "User role")

	userPasswordCmd.Flags().StringVar(&userUsername, "username", "", "Username (required)")
	userPasswordCmd.Flags().StringVar(&userPassword, "password", "", "New password")

	userCmd.AddCommand(userAddCmd)
	userCmd.AddCommand(userPasswordCmd)
	rootCmd.AddCommand(userCmd)
}

var userCmd = &cobra.Command{
	Use:   "user",
	Short: "Manage WordPress users",
}

var userAddCmd = &cobra.Command{
	Use:   "add <site>",
	Short: "Add a WordPress user",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		site, err := registry.Get(name)
		if err != nil {
			return err
		}

		if userUsername == "" {
			return fmt.Errorf("--username is required")
		}

		wpArgs := []string{
			"user", "create", userUsername,
		}
		if userEmail != "" {
			wpArgs = append(wpArgs, userEmail)
		} else {
			wpArgs = append(wpArgs, userUsername+"@test.com")
		}
		wpArgs = append(wpArgs, "--role="+userRole)
		if userPassword != "" {
			wpArgs = append(wpArgs, "--user_pass="+userPassword)
		}

		output, err := wpcli.Run(site.Name, site.Path, wpArgs...)
		if err != nil {
			return err
		}
		fmt.Print(output)
		return nil
	},
}

var userPasswordCmd = &cobra.Command{
	Use:   "password <site>",
	Short: "Change a WordPress user's password",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		site, err := registry.Get(name)
		if err != nil {
			return err
		}

		if userUsername == "" {
			return fmt.Errorf("--username is required")
		}
		if userPassword == "" {
			return fmt.Errorf("--password is required")
		}

		output, err := wpcli.Run(site.Name, site.Path,
			"user", "update", userUsername,
			"--user_pass="+userPassword,
		)
		if err != nil {
			return err
		}
		fmt.Print(output)
		return nil
	},
}
