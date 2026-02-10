/**
 * Tests for x509.ts
 * Tests X.509 certificate parsing and public key extraction
 */

import { importPublicKeyFromX509 } from './x509';

describe('X.509 Certificate Parser', () => {
  let mockCryptoKey: CryptoKey;
  let mockImportKey: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock CryptoKey
    mockCryptoKey = {
      type: 'public',
      extractable: true,
      algorithm: { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
      usages: ['verify'],
    } as CryptoKey;

    // Mock crypto.subtle.importKey
    mockImportKey = jest.fn().mockResolvedValue(mockCryptoKey);
    global.crypto = {
      subtle: {
        importKey: mockImportKey,
      } as any,
    } as any;
  });

  // Minimal valid X.509 certificate (self-signed test certificate)
  // This is a real certificate structure but with minimal fields
  const VALID_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHCgVZU2T/MA0GCSqGSIb3DQEBBQUAMA0xCzAJBgNVBAYTAlVT
MB4XDTA5MDcxNTIyNTUzOVoXDTEwMDcxNTIyNTUzOVowDTELMAkGA1UEBhMCVVMw
gZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAMYBBrx5PlP0WNI/ZdzD+6Pktmur
nn7dTK/hOdBgqCJrvypnDdWlV8kCLKH0dK6cE/kEW6CU6+5L9Z5OQjk6eIkch4pN
cVQr1pL7AsVnCO/+3qvphAvk0NcKmraU9+9sNglc8qEDDzOG9GPtAgMBAAEwDQYJ
KoZIhvcNAQEFBQADgYEAtuUN/9vGjJEc5l7KPJp0b4LEFl7E9pzU/EgRJbfVaSVt
JTDydAR0a3e8ZIdfZDRbPDe/MKxP+gu3vLOOB2t1KKmuTenqCNduxAUhRPiU5dGS
YXoC2jjinhIUsYu+2RVU5NqkqMXqNvvDYtVa4/0zzCKPWVU=
-----END CERTIFICATE-----`;

  describe('importPublicKeyFromX509', () => {
    it('should import public key from valid PEM certificate', async () => {
      const key = await importPublicKeyFromX509(VALID_CERT_PEM);
      
      expect(key).toBe(mockCryptoKey);
      expect(mockImportKey).toHaveBeenCalledTimes(1);
    });

    it('should call crypto.subtle.importKey with correct parameters', async () => {
      await importPublicKeyFromX509(VALID_CERT_PEM);
      
      expect(mockImportKey).toHaveBeenCalledWith(
        'spki',
        expect.any(Uint8Array),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        true,
        ['verify']
      );
    });

    it('should remove PEM headers and whitespace', async () => {
      const certWithExtraWhitespace = `
        -----BEGIN CERTIFICATE-----
        MIIBkTCB+wIJAKHHCgVZU2T/MA0GCSqGSIb3DQEBBQUAMA0xCzAJBgNVBAYTAlVT
        MB4XDTA5MDcxNTIyNTUzOVoXDTEwMDcxNTIyNTUzOVowDTELMAkGA1UEBhMCVVMw
        gZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAMYBBrx5PlP0WNI/ZdzD+6Pktmur
        nn7dTK/hOdBgqCJrvypnDdWlV8kCLKH0dK6cE/kEW6CU6+5L9Z5OQjk6eIkch4pN
        cVQr1pL7AsVnCO/+3qvphAvk0NcKmraU9+9sNglc8qEDDzOG9GPtAgMBAAEwDQYJ
        KoZIhvcNAQEFBQADgYEAtuUN/9vGjJEc5l7KPJp0b4LEFl7E9pzU/EgRJbfVaSVt
        JTDydAR0a3e8ZIdfZDRbPDe/MKxP+gu3vLOOB2t1KKmuTenqCNduxAUhRPiU5dGS
        YXoC2jjinhIUsYu+2RVU5NqkqMXqNvvDYtVa4/0zzCKPWVU=
        -----END CERTIFICATE-----
      `;
      
      const key = await importPublicKeyFromX509(certWithExtraWhitespace);
      expect(key).toBe(mockCryptoKey);
    });

    it('should handle certificate with newlines in base64', async () => {
      const key = await importPublicKeyFromX509(VALID_CERT_PEM);
      expect(key).toBe(mockCryptoKey);
      expect(mockImportKey).toHaveBeenCalled();
    });

    it('should throw error for invalid base64', async () => {
      const invalidCert = `-----BEGIN CERTIFICATE-----
!!!INVALID BASE64!!!
-----END CERTIFICATE-----`;
      
      await expect(importPublicKeyFromX509(invalidCert)).rejects.toThrow();
    });

    it('should throw error for malformed certificate structure', async () => {
      // Valid base64 but not a valid certificate structure
      const malformedCert = `-----BEGIN CERTIFICATE-----
SGVsbG8gV29ybGQ=
-----END CERTIFICATE-----`;
      
      await expect(importPublicKeyFromX509(malformedCert)).rejects.toThrow();
    });

    it('should throw error if crypto.subtle.importKey fails', async () => {
      mockImportKey.mockRejectedValue(new Error('Import failed'));
      
      await expect(importPublicKeyFromX509(VALID_CERT_PEM)).rejects.toThrow('Import failed');
    });

    it('should handle certificate without version field', async () => {
      // Some certificates don't have explicit version field (defaults to v1)
      const certWithoutVersion = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHCgVZU2T/MA0GCSqGSIb3DQEBBQUAMA0xCzAJBgNVBAYTAlVT
MB4XDTA5MDcxNTIyNTUzOVoXDTEwMDcxNTIyNTUzOVowDTELMAkGA1UEBhMCVVMw
gZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAMYBBrx5PlP0WNI/ZdzD+6Pktmur
nn7dTK/hOdBgqCJrvypnDdWlV8kCLKH0dK6cE/kEW6CU6+5L9Z5OQjk6eIkch4pN
cVQr1pL7AsVnCO/+3qvphAvk0NcKmraU9+9sNglc8qEDDzOG9GPtAgMBAAEwDQYJ
KoZIhvcNAQEFBQADgYEAtuUN/9vGjJEc5l7KPJp0b4LEFl7E9pzU/EgRJbfVaSVt
JTDydAR0a3e8ZIdfZDRbPDe/MKxP+gu3vLOOB2t1KKmuTenqCNduxAUhRPiU5dGS
YXoC2jjinhIUsYu+2RVU5NqkqMXqNvvDYtVa4/0zzCKPWVU=
-----END CERTIFICATE-----`;
      
      const key = await importPublicKeyFromX509(certWithoutVersion);
      expect(key).toBe(mockCryptoKey);
    });

    it('should return CryptoKey with correct properties', async () => {
      const key = await importPublicKeyFromX509(VALID_CERT_PEM);
      
      expect(key.type).toBe('public');
      expect(key.extractable).toBe(true);
      expect(key.usages).toContain('verify');
    });

    it('should handle empty certificate string', async () => {
      await expect(importPublicKeyFromX509('')).rejects.toThrow();
    });

    it('should handle certificate with only headers', async () => {
      const emptyCert = `-----BEGIN CERTIFICATE-----
-----END CERTIFICATE-----`;
      
      await expect(importPublicKeyFromX509(emptyCert)).rejects.toThrow();
    });
  });

  describe('Certificate Parsing Edge Cases', () => {
    it('should handle certificate with Windows line endings', async () => {
      const certWithCRLF = VALID_CERT_PEM.replace(/\n/g, '\r\n');
      const key = await importPublicKeyFromX509(certWithCRLF);
      expect(key).toBe(mockCryptoKey);
    });

    it('should handle certificate with mixed line endings', async () => {
      const certWithMixedEndings = VALID_CERT_PEM.replace(/\n/g, () => 
        Math.random() > 0.5 ? '\r\n' : '\n'
      );
      const key = await importPublicKeyFromX509(certWithMixedEndings);
      expect(key).toBe(mockCryptoKey);
    });

    it('should handle certificate with tabs and spaces', async () => {
      const certWithWhitespace = VALID_CERT_PEM.replace(/\n/g, '\n\t  ');
      const key = await importPublicKeyFromX509(certWithWhitespace);
      expect(key).toBe(mockCryptoKey);
    });
  });

  describe('ASN.1 Parsing', () => {
    it('should correctly parse ASN.1 DER structure', async () => {
      // The function should parse the certificate's ASN.1 structure
      // and extract the SubjectPublicKeyInfo (SPKI)
      await importPublicKeyFromX509(VALID_CERT_PEM);
      
      // Verify that importKey was called with SPKI format
      const call = mockImportKey.mock.calls[0];
      expect(call[0]).toBe('spki');
      
      // Verify the buffer is not empty
      const buffer = call[1] as ArrayBuffer;
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should extract correct algorithm parameters', async () => {
      await importPublicKeyFromX509(VALID_CERT_PEM);
      
      const call = mockImportKey.mock.calls[0];
      const algorithm = call[2] as any;
      
      expect(algorithm.name).toBe('RSASSA-PKCS1-v1_5');
      expect(algorithm.hash).toBe('SHA-256');
    });

    it('should set correct key usages', async () => {
      await importPublicKeyFromX509(VALID_CERT_PEM);
      
      const call = mockImportKey.mock.calls[0];
      const usages = call[4] as KeyUsage[];
      
      expect(usages).toEqual(['verify']);
    });

    it('should set extractable to true', async () => {
      await importPublicKeyFromX509(VALID_CERT_PEM);
      
      const call = mockImportKey.mock.calls[0];
      const extractable = call[3] as boolean;
      
      expect(extractable).toBe(true);
    });
  });
});
