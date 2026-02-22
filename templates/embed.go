package templates

import "embed"

//go:embed *.conf *.yml *.tmpl
var FS embed.FS
