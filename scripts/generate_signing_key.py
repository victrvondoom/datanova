"""Operator tool: generate an ed25519 artifact-signing keypair.

Usage:
    python scripts/generate_signing_key.py <private_key.pem> <public_key.pem>

Key governance: run OFFLINE; keep the private key out of the repository,
container images, and logs. Serving environments receive ONLY the public
key via AEGIS_SIGNING_PUBKEY. Artifacts are signed by setting
AEGIS_SIGNING_KEY (private key path) when saving the champion bundle.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from packages.artifacts.signing import generate_keypair


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    private_path, public_path = sys.argv[1], sys.argv[2]
    if os.path.exists(private_path):
        print(f"ERROR: refusing to overwrite existing private key '{private_path}'.")
        return 1
    info = generate_keypair(private_path, public_path)
    print(f"Private key: {info['private_key']} (KEEP SECRET — never commit)")
    print(f"Public key:  {info['public_key']}  (distribute to serving envs)")
    print(f"Key id:      {info['key_id']}")
    print("Next: AEGIS_SIGNING_KEY=<private> on the training host,")
    print("      AEGIS_SIGNING_PUBKEY=<public> on serving hosts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
