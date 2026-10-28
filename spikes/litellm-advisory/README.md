# LiteLLM advisory check (WP0 spike)

Question: which LiteLLM version can the engine pin (plan §6.4, R13)?

Result (checked 2026-10-28):
- **Oct 21 2026: 1.107.0 was a credential stealer** published to PyPI and to Docker tags. PyPI now returns 404 for it. Vendor and [Cloudsmith](https://cloudsmith.com/blog/litellm-1-107-0-compromised-on-pypi) say pin to 1.106.2 or earlier. Sourced from the Cloudsmith write-up only. LiteLLM's own incident post was not read, so re-check it.
- **Mar 24 2026: 1.82.7 and 1.82.8** were backdoored (TeamPCP, via a compromised Trivy step in LiteLLM CI). PyPI now returns 404. Last safe pre-incident version: 1.82.6 ([PureAI report](https://pureai.com/Articles/2026/03/25/PyPI-Removes-Compromised-LiteLLM-Releases-After-Warnings-of-Stolen-Credentials.aspx)).
- **Pin decision: 1.106.2** (vendor-stated). Versions 1.106.3 (Oct 24), 1.106.4 (Oct 25) and 1.106.5 (Oct 27) were released after the incident and are not covered by the vendor's advice. Do not pin them until LiteLLM's incident post names them as safe.
- Hash-lock the pin (plan R13) and record the hashes in the engine lock file in WP2.

Run: `python3 check.py [version ...]`. Exit 1 if a listed compromised version is checked. The advisory list is hand-entered; re-verify it before use.

Not checked: the Docker Hub and GHCR image tags. Check them by digest if the engine image uses LiteLLM's image.
