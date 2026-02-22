package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/registry"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(listCmd)
}

var listCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List all WordPress sites",
	RunE: func(cmd *cobra.Command, args []string) error {
		sites, err := registry.List()
		if err != nil {
			return err
		}

		if len(sites) == 0 {
			fmt.Println("No sites found. Create one with: wpmax create <name>")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
		fmt.Fprintln(w, "NAME\tURL\tSTATUS\tCREATED")
		for _, site := range sites {
			status := "stopped"
			if docker.ContainerRunning(site.Name + "-wordpress") {
				status = "running"
			}
			created := site.CreatedAt.Format("2006-01-02")
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", site.Name, site.URL, status, created)
		}
		w.Flush()
		return nil
	},
}
