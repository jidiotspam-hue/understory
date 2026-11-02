# 🌿 understory

> A quiet, earthy index interface designed with client-side zero-knowledge encryption.

Inspired by the design philosophy of [`cloak`](https://jidiotspam-hue.github.io/cloak/):
- **Earthy, tactile aesthetics**: Warm cream paper background (`#F3EEE8`), dark mode (`#171521`), muted ink, terracotta and sage accents.
- **Typography-first**: Caprasimo display headings with Figtree body.
- **Client-Side Zero-Knowledge Encryption**: The database is encrypted via AES-256-GCM + PBKDF2 (250,000 iterations). No plaintext URLs or metadata are stored in this repository. Decryption happens strictly in browser memory.
- **Motion carries state**: Subtle breathing mark emblem, fluid hover underlines, smooth transitions.

---

## 🔒 Security Architecture

1. **Zero-Knowledge Storage**: `data.js` contains solely high-entropy AES-GCM ciphertext. Inspecting the repository or network responses yields zero metadata.
2. **In-Memory Decryption**: Web Crypto API (`crypto.subtle`) decrypts entries directly into memory upon passphrase verification.
3. **Session Cleansing**: Locking the vault purges memory and session storage instantly.
4. **Camouflage Mode**: Pressing `Escape` or clicking the `⌘` button immediately masks the interface with an innocent academic reading syllabus.

---

## 🚀 Local Usage

Simply open `index.html` in any modern web browser:
```bash
open index.html
```
