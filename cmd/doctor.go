package cmd

import (
	"fmt"
	"net"
	"os/exec"

	"github.com/maxcelos/wpmax/internal/certs"
	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/internal/proxy"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(doctorCmd)
}

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Check system requirements and status",
	RunE: func(cmd *cobra.Command, args []string) error {
		allGood := true

		check := func(name string, ok bool, detail string) {
			if ok {
				fmt.Printf("  [PASS] %s\n", name)
			} else {
				fmt.Printf("  [FAIL] %s — %s\n", name, detail)
				allGood = false
			}
		}

		fmt.Println("System checks:")
		fmt.Println()

		// Docker
		check("Docker installed", isCommandAvailable("docker"), "install Docker Desktop")
		check("Docker running", docker.IsRunning(), "start Docker Desktop")

		// Docker Compose
		composeOk := isCommandAvailable("docker")
		if composeOk {
			out, err := exec.Command("docker", "compose", "version").Output()
			composeOk = err == nil && len(out) > 0
		}
		check("Docker Compose v2", composeOk, "update Docker Desktop for Compose v2")

		// mkcert
		check("mkcert installed", certs.IsMkcertInstalled(), "run: brew install mkcert")

		// Certs
		check("Wildcard certs exist", certs.CertsExist(), "run: wpmax init")

		// Network
		check("wpmax network exists", docker.NetworkExists("wpmax"), "run: wpmax init")

		// Proxy
		check("Proxy running", proxy.IsRunning(), "run: wpmax init")

		// Port 80
		port80Free := isPortFree(80)
		proxyRunning := proxy.IsRunning()
		check("Port 80 available", port80Free || proxyRunning, "another service is using port 80")

		// Port 443
		port443Free := isPortFree(443)
		check("Port 443 available", port443Free || proxyRunning, "another service is using port 443")

		fmt.Println()
		if allGood {
			fmt.Println("All checks passed!")
		} else {
			fmt.Println("Some checks failed. Fix the issues above and run 'wpmax doctor' again.")
		}

		return nil
	},
}

func isCommandAvailable(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func isPortFree(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}
