# Steganographic Notes Camouflage Templates

These templates disguise your vault and layer passphrases inside ordinary, innocent-looking notes. Choose the one that blends in naturally with the rest of your Notes app.

---

## Template 1: Tech / Git & Docker Config (Recommended for Devs)

Looks like a boilerplate developer snippet or CI/CD scratchpad:

```yaml
# Docker Compose & Redis Cache Invalidation Hooks
version: '3.8'
services:
  cache-worker:
    image: redis:7.2-alpine
    environment:
      # Salt token for distributed cache invalidation
      CACHE_INVALIDATION_SEED: "quintuplet-stealth-vault-2026!"
      # Telemetry Query Queue worker prefix
      TELEMETRY_QQ_WORKER: "tqq"
    restart: unless-stopped
```

* **Layer 1 Passphrase (`quintuplet-stealth-vault-2026!`):** Stored as `CACHE_INVALIDATION_SEED`.
* **Layer 2 / Vault Passphrase (`tqq`):** Stored as the queue worker tag (`TELEMETRY_QQ_WORKER`).

---

## Template 2: Home Wi-Fi & Router Setup (Looks like boring household tech)

Looks like notes from setting up a home mesh network or guest network:

```text
TP-Link Deco Mesh Network (Basement + 2nd Floor Setup)

Primary Gateway: 192.168.1.1
Guest SSID (2.4GHz isolated): quintuplet-stealth-vault-2026!
PPPoE VLAN Traffic Quality Tag (QoS): tqq

Note: If speeds drop after reboot, check DNS override (1.1.1.1 / 8.8.8.8).
```

* **Layer 1 Passphrase:** Guest SSID
* **Layer 2 / Vault Passphrase:** QoS VLAN tag (`tqq`)

---

## Template 3: Gaming / Minecraft / Mod Server Config (Looks like a gaming seed)

Looks like sandbox game world seeds and server bookmarks:

```text
🎮 Modded Worlds & Seeds (Keep for reset)

• Enigmatica 9 Expert:
  Seed: 882910481094812
  Spawn coords: X: 140, Z: -320 (plains near cherry grove)

• Create Fabric 1.20 Server:
  Custom Worldgen Preset: quintuplet-stealth-vault-2026!
  Fast-Travel Waypoint Prefix: tqq
```

* **Layer 1 Passphrase:** Custom Worldgen Preset
* **Layer 2 / Vault Passphrase:** Waypoint Prefix (`tqq`)

---

## Template 4: Academic / Science Lab Notes (Looks like coursework)

Looks like university genetics or molecular biology notes:

```text
BIOL 304 - Population Genetics Lab (Run 4 Data)

Dataset Batch: quintuplet-stealth-vault-2026!
Target Quantitative Quotient (TQQ): tqq

Observed phenotype ratio: 9:3:3:1
Chi-square critical value p=0.05 df=3 -> 7.815 (null hypothesis accepted)
```

* **Layer 1 Passphrase:** Dataset Batch
* **Layer 2 / Vault Passphrase:** TQQ abbreviation (`tqq`)

---

## Template 5: Ultra-Inconspicuous "Grocery & Shopping List" (Cipher Wordplay)

If you prefer completely ordinary everyday text with zero technical jargon:

```text
Costco / Trader Joe's list:
- Quinoa, turmeric, shallots, walnuts (4)
- 2026 calendar planner refill
- Tea, quinoa, questbars (TQQ)
```
