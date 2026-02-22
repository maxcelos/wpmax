package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const dirName = "wpmax"

type Config struct {
	DefaultPluginsPath string   `json:"defaultPluginsPath,omitempty"`
	DefaultThemesPath  string   `json:"defaultThemesPath,omitempty"`
	PublicPlugins      []string `json:"publicPlugins,omitempty"`
	PublicThemes       []string `json:"publicThemes,omitempty"`
	DBUser             string   `json:"dbUser"`
	DBPassword         string   `json:"dbPassword"`
	AdminUser          string   `json:"adminUser"`
	AdminEmail         string   `json:"adminEmail"`
	AdminPassword      string   `json:"adminPassword"`
}

func Defaults() Config {
	return Config{
		DBUser:        "wordpress",
		DBPassword:    "wordpress",
		AdminUser:     "admin",
		AdminEmail:    "admin@test.com",
		AdminPassword: "admin",
	}
}

// Dir returns ~/.config/wpmax
func Dir() string {
	cfgDir, _ := os.UserConfigDir()
	return filepath.Join(cfgDir, dirName)
}

// CertsDir returns ~/.config/wpmax/certs
func CertsDir() string {
	return filepath.Join(Dir(), "certs")
}

// ProxyDir returns ~/.config/wpmax/proxy
func ProxyDir() string {
	return filepath.Join(Dir(), "proxy")
}

// ProxyConfDir returns ~/.config/wpmax/proxy/conf.d
func ProxyConfDir() string {
	return filepath.Join(ProxyDir(), "conf.d")
}

// EnsureDirs creates all required config directories.
func EnsureDirs() error {
	dirs := []string{Dir(), CertsDir(), ProxyDir(), ProxyConfDir()}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return err
		}
	}
	return nil
}

func configPath() string {
	return filepath.Join(Dir(), "config.json")
}

// Load reads config.json, merging over defaults.
func Load() (Config, error) {
	cfg := Defaults()
	data, err := os.ReadFile(configPath())
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Defaults(), err
	}
	// Ensure defaults for empty required fields
	d := Defaults()
	if cfg.DBUser == "" {
		cfg.DBUser = d.DBUser
	}
	if cfg.DBPassword == "" {
		cfg.DBPassword = d.DBPassword
	}
	if cfg.AdminUser == "" {
		cfg.AdminUser = d.AdminUser
	}
	if cfg.AdminEmail == "" {
		cfg.AdminEmail = d.AdminEmail
	}
	if cfg.AdminPassword == "" {
		cfg.AdminPassword = d.AdminPassword
	}
	return cfg, nil
}

// Save writes config to disk.
func Save(cfg Config) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0644)
}

// Get returns a config value by key name.
func Get(key string) (string, error) {
	cfg, err := Load()
	if err != nil {
		return "", err
	}
	switch key {
	case "default-plugins-path":
		return cfg.DefaultPluginsPath, nil
	case "default-themes-path":
		return cfg.DefaultThemesPath, nil
	case "db-user":
		return cfg.DBUser, nil
	case "db-password":
		return cfg.DBPassword, nil
	case "admin-user":
		return cfg.AdminUser, nil
	case "admin-email":
		return cfg.AdminEmail, nil
	case "admin-password":
		return cfg.AdminPassword, nil
	default:
		return "", fmt.Errorf("unknown config key: %s", key)
	}
}

// Set updates a config value by key name.
func Set(key, value string) error {
	cfg, err := Load()
	if err != nil {
		return err
	}
	switch key {
	case "default-plugins-path":
		cfg.DefaultPluginsPath = value
	case "default-themes-path":
		cfg.DefaultThemesPath = value
	case "db-user":
		cfg.DBUser = value
	case "db-password":
		cfg.DBPassword = value
	case "admin-user":
		cfg.AdminUser = value
	case "admin-email":
		cfg.AdminEmail = value
	case "admin-password":
		cfg.AdminPassword = value
	default:
		return fmt.Errorf("unknown config key: %s", key)
	}
	return Save(cfg)
}

// AddToList appends a value to a list config key.
func AddToList(key, value string) error {
	cfg, err := Load()
	if err != nil {
		return err
	}
	switch key {
	case "public-plugins":
		cfg.PublicPlugins = appendUnique(cfg.PublicPlugins, value)
	case "public-themes":
		cfg.PublicThemes = appendUnique(cfg.PublicThemes, value)
	default:
		return fmt.Errorf("unknown list config key: %s", key)
	}
	return Save(cfg)
}

// RemoveFromList removes a value from a list config key.
func RemoveFromList(key, value string) error {
	cfg, err := Load()
	if err != nil {
		return err
	}
	switch key {
	case "public-plugins":
		cfg.PublicPlugins = removeItem(cfg.PublicPlugins, value)
	case "public-themes":
		cfg.PublicThemes = removeItem(cfg.PublicThemes, value)
	default:
		return fmt.Errorf("unknown list config key: %s", key)
	}
	return Save(cfg)
}

func appendUnique(slice []string, val string) []string {
	for _, s := range slice {
		if s == val {
			return slice
		}
	}
	return append(slice, val)
}

func removeItem(slice []string, val string) []string {
	result := make([]string, 0, len(slice))
	for _, s := range slice {
		if s != val {
			result = append(result, s)
		}
	}
	return result
}

