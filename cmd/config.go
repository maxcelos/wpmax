package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/maxcelos/wpmax/internal/config"
	"github.com/spf13/cobra"
)

var (
	configList   bool
	configSet    bool
	configAdd    bool
	configRemove bool
)

func init() {
	configCmd.Flags().BoolVar(&configList, "list", false, "List all config values")
	configCmd.Flags().BoolVar(&configSet, "set", false, "Set a config value (key value)")
	configCmd.Flags().BoolVar(&configAdd, "add", false, "Add a value to a list config (key value)")
	configCmd.Flags().BoolVar(&configRemove, "remove", false, "Remove a value from a list config (key value)")
	rootCmd.AddCommand(configCmd)
}

var configCmd = &cobra.Command{
	Use:   "config [--list|--set key value|--add key value|--remove key value]",
	Short: "Manage wpmax configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		if configList {
			cfg, err := config.Load()
			if err != nil {
				return err
			}
			data, err := json.MarshalIndent(cfg, "", "  ")
			if err != nil {
				return err
			}
			fmt.Println(string(data))
			return nil
		}

		if configSet {
			if len(args) != 2 {
				return fmt.Errorf("usage: wpmax config --set <key> <value>")
			}
			if err := config.Set(args[0], args[1]); err != nil {
				return err
			}
			fmt.Printf("Set %s = %s\n", args[0], args[1])
			return nil
		}

		if configAdd {
			if len(args) != 2 {
				return fmt.Errorf("usage: wpmax config --add <key> <value>")
			}
			if err := config.AddToList(args[0], args[1]); err != nil {
				return err
			}
			fmt.Printf("Added %s to %s\n", args[1], args[0])
			return nil
		}

		if configRemove {
			if len(args) != 2 {
				return fmt.Errorf("usage: wpmax config --remove <key> <value>")
			}
			if err := config.RemoveFromList(args[0], args[1]); err != nil {
				return err
			}
			fmt.Printf("Removed %s from %s\n", args[1], args[0])
			return nil
		}

		return cmd.Help()
	},
}
