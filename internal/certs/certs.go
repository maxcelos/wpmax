package certs

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/maxcelos/wpmax/internal/config"
)

// IsMkcertInstalled checks if mkcert is in PATH.
func IsMkcertInstalled() bool {
	_, err := exec.LookPath("mkcert")
	return err == nil
}

// InstallMkcert installs mkcert using the platform's package manager.
func InstallMkcert() error {
	var name string
	var args []string

	switch runtime.GOOS {
	case "darwin":
		name = "brew"
		args = []string{"install", "mkcert"}
	case "windows":
		name = "choco"
		args = []string{"install", "mkcert", "-y"}
	default:
		return fmt.Errorf("please install mkcert manually: https://github.com/FiloSottile/mkcert#installation")
	}

	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// InstallCA runs mkcert -install to set up the local CA.
func InstallCA() error {
	cmd := exec.Command("mkcert", "-install")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// GenerateWildcard generates a wildcard certificate for *.wpmax.localhost.
func GenerateWildcard() error {
	certsDir := config.CertsDir()
	certFile := filepath.Join(certsDir, "wpmax.localhost.pem")
	keyFile := filepath.Join(certsDir, "wpmax.localhost-key.pem")

	cmd := exec.Command("mkcert",
		"-cert-file", certFile,
		"-key-file", keyFile,
		"*.wpmax.localhost",
		"wpmax.localhost",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// CertsExist checks if the wildcard certificate files exist.
func CertsExist() bool {
	certsDir := config.CertsDir()
	certFile := filepath.Join(certsDir, "wpmax.localhost.pem")
	keyFile := filepath.Join(certsDir, "wpmax.localhost-key.pem")
	if _, err := os.Stat(certFile); err != nil {
		return false
	}
	if _, err := os.Stat(keyFile); err != nil {
		return false
	}
	return true
}

// CertPath returns the path to the certificate file.
func CertPath() string {
	return filepath.Join(config.CertsDir(), "wpmax.localhost.pem")
}

// KeyPath returns the path to the key file.
func KeyPath() string {
	return filepath.Join(config.CertsDir(), "wpmax.localhost-key.pem")
}

// EnsureCerts checks and generates certificates if needed.
func EnsureCerts() error {
	if !IsMkcertInstalled() {
		fmt.Println("Installing mkcert...")
		if err := InstallMkcert(); err != nil {
			return fmt.Errorf("failed to install mkcert: %w", err)
		}
	}

	fmt.Println("Setting up local CA...")
	if err := InstallCA(); err != nil {
		return fmt.Errorf("failed to install local CA: %w", err)
	}

	if !CertsExist() {
		fmt.Println("Generating wildcard certificate...")
		if err := GenerateWildcard(); err != nil {
			return fmt.Errorf("failed to generate certificates: %w", err)
		}
	}

	return nil
}
