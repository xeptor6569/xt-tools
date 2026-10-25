import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { x509Decoder } from './logic.ts';

/** Self-signed P-256 certificate generated locally with OpenSSL. Not fetched. */
export const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`;

describe('x509Decoder', () => {
  it('reads the self-signed fixture', () => {
    const out = x509Decoder(SAMPLE_CERT);
    expect(out).toContain('subject: CN=xt-tools.example, O=xt-tools');
    expect(out).toContain('issuer: CN=xt-tools.example, O=xt-tools');
    expect(out).toContain('serial: 588ae2518701c1846f3e8c46baae38e48d0bbf0b');
    expect(out).toContain('notBefore: 2026-10-25 00:00:28 UTC');
    expect(out).toContain('notAfter: 2036-10-22 00:00:28 UTC');
    expect(out).toContain('signatureAlgorithm: ecdsa-with-SHA256');
    expect(out).toContain('san: DNS:xt-tools.example, DNS:localhost');
  });

  it('returns nothing for an empty box and rejects a non-certificate', () => {
    expect(x509Decoder('')).toBe('');
    expect(() => x509Decoder('hello')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(x509Decoder);
  });
});
