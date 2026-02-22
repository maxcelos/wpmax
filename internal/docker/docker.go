package docker

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// ProjectName returns the compose project name for a site.
func ProjectName(siteName string) string {
	return "wpmax-" + siteName
}

const ProxyProject = "wpmax-proxy"

// IsRunning checks if the Docker daemon is accessible.
func IsRunning() bool {
	cmd := exec.Command("docker", "info")
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run() == nil
}

// NetworkExists checks if a Docker network exists.
func NetworkExists(name string) bool {
	cmd := exec.Command("docker", "network", "inspect", name)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run() == nil
}

// CreateNetwork creates a Docker network.
func CreateNetwork(name string) error {
	cmd := exec.Command("docker", "network", "create", name)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ContainerRunning checks if a container is running by name.
func ContainerRunning(name string) bool {
	var out bytes.Buffer
	cmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", name)
	cmd.Stdout = &out
	cmd.Stderr = nil
	if err := cmd.Run(); err != nil {
		return false
	}
	return strings.TrimSpace(out.String()) == "true"
}

// ContainerExists checks if a container exists (running or stopped).
func ContainerExists(name string) bool {
	cmd := exec.Command("docker", "inspect", name)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run() == nil
}

// Exec runs a command inside a running container.
func Exec(container string, args ...string) (string, error) {
	cmdArgs := append([]string{"exec", container}, args...)
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("%w: %s", err, errOut.String())
	}
	return out.String(), nil
}

// ExecInteractive runs an interactive command inside a running container.
func ExecInteractive(container string, args ...string) error {
	cmdArgs := append([]string{"exec", "-it", container}, args...)
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// composeArgs builds the base args with project name for docker compose commands.
func composeArgs(project string, args ...string) []string {
	base := []string{"compose", "-p", project}
	return append(base, args...)
}

// ComposeUp runs docker compose up -d in the given directory.
func ComposeUp(project, dir string) error {
	cmd := exec.Command("docker", composeArgs(project, "up", "-d", "--wait")...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ComposeDown runs docker compose down in the given directory.
func ComposeDown(project, dir string, removeVolumes bool) error {
	args := composeArgs(project, "down")
	if removeVolumes {
		args = append(args, "-v")
	}
	cmd := exec.Command("docker", args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ComposeStop runs docker compose stop in the given directory.
func ComposeStop(project, dir string) error {
	cmd := exec.Command("docker", composeArgs(project, "stop")...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ComposeStart runs docker compose start in the given directory.
func ComposeStart(project, dir string) error {
	cmd := exec.Command("docker", composeArgs(project, "start")...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ComposeRun runs a one-off command via docker compose run --rm.
func ComposeRun(project, dir string, service string, args ...string) (string, error) {
	cmdArgs := composeArgs(project, append([]string{"run", "--rm", service}, args...)...)
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = dir
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("%w: %s", err, errOut.String())
	}
	return out.String(), nil
}

// ComposeRunInteractive runs an interactive one-off command via docker compose run --rm.
func ComposeRunInteractive(project, dir string, service string, args ...string) error {
	cmdArgs := composeArgs(project, append([]string{"run", "--rm", service}, args...)...)
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = dir
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ComposeExec runs a command in an already-running compose service.
func ComposeExec(project, dir string, service string, args ...string) (string, error) {
	cmdArgs := composeArgs(project, append([]string{"exec", service}, args...)...)
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = dir
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("%w: %s", err, errOut.String())
	}
	return out.String(), nil
}

// ComposePS returns the output of docker compose ps for a given directory.
func ComposePS(project, dir string) (string, error) {
	var out bytes.Buffer
	cmd := exec.Command("docker", composeArgs(project, "ps", "--format", "json")...)
	cmd.Dir = dir
	cmd.Stdout = &out
	cmd.Stderr = nil
	if err := cmd.Run(); err != nil {
		return "", err
	}
	return out.String(), nil
}
