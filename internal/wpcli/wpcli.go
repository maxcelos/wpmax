package wpcli

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"

	"github.com/maxcelos/wpmax/internal/docker"
)

// Run executes a WP-CLI command inside the site's CLI container.
func Run(siteName, projectDir string, args ...string) (string, error) {
	project := docker.ProjectName(siteName)
	cmdArgs := []string{"compose", "-p", project, "run", "--rm", "cli", "wp"}
	cmdArgs = append(cmdArgs, args...)

	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = projectDir
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("wp-cli error: %w\n%s", err, errOut.String())
	}
	return out.String(), nil
}

// RunInteractive executes a WP-CLI command with stdin/stdout attached.
func RunInteractive(siteName, projectDir string, args ...string) error {
	project := docker.ProjectName(siteName)
	cmdArgs := []string{"compose", "-p", project, "run", "--rm", "cli", "wp"}
	cmdArgs = append(cmdArgs, args...)

	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = projectDir
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
