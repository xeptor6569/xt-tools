import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'x509-decoder',
  name: 'X.509 decoder',
  description: 'Decode a PEM X.509 certificate and list its fields.',
  category: 'crypto',
  keywords: ['x509', 'certificate', 'pem', 'tls', 'decode'],
  tags: ['certificate', 'tls'],
  examples: [
    {
      input: `-----BEGIN CERTIFICATE-----
MIIB2DCCAX+gAwIBAgIUWIriUYcBwYRvPoxGuq445I0LvwswCgYIKoZIzj0EAwIw
LjEZMBcGA1UEAwwQeHQtdG9vbHMuZXhhbXBsZTERMA8GA1UECgwIeHQtdG9vbHMw
HhcNMjYxMDI1MDAwMDI4WhcNMzYxMDIyMDAwMDI4WjAuMRkwFwYDVQQDDBB4dC10
b29scy5leGFtcGxlMREwDwYDVQQKDAh4dC10b29sczBZMBMGByqGSM49AgEGCCqG
SM49AwEHA0IABL9hQp1ESHwYo6ryK06/MqS1p0yu3ruapFPGbYBnP21DG+PlvrHb
fnuWO+Hj5NopCuR4KiLJ1DDF5/JFR/ZIbDGjezB5MB0GA1UdDgQWBBTQM0MtEH+U
wmJOmOHe2KGsnkTyXTAfBgNVHSMEGDAWgBTQM0MtEH+UwmJOmOHe2KGsnkTyXTAP
BgNVHRMBAf8EBTADAQH/MCYGA1UdEQQfMB2CEHh0LXRvb2xzLmV4YW1wbGWCCWxv
Y2FsaG9zdDAKBggqhkjOPQQDAgNHADBEAiAc+Ra0WwLy9mWr9O24YHVyq8qq7U1W
Kzj7YHKIhiKZyQIgSorP+XEt8L4uWkOQcjlCmcHhizg8OkabrrxD/PC89A0=
-----END CERTIFICATE-----`,
      expect: 'CN=xt-tools.example',
    },
  ],
  added: '2026-10-24',
};

export default meta;
