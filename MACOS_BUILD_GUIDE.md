# Mintu v0.2.4 macOS Quraşdırma və Yığım Bələdçisi (Build Guide)

Bu layihə Mintu Dynamic Island desktop pet və məhsuldarlıq köməkçisinin macOS (Apple Silicon M1/M2/M3/M4 və Intel x86_64) üçün uyğunlaşdırılmış v0.2.4 versiyasıdır.

Mintu v0.2.4 tamamilə süni intellektdən azad (Zero AI), ultra-yüngül (<30 MB) və 100% məxfi desktop yoldaşıdır.

---

## 1. İlkin Tələblər (Prerequisites)

macOS sistemində Mintu-nu işə salmaq və ya paketləmək üçün aşağıdakı proqram təminatları tələb olunur:

1. **Xcode Command Line Tools**:
   Terminalda icra edin:
   ```bash
   xcode-select --install
   ```

2. **Node.js və npm (v18 və ya daha yeni)**:
   Homebrew ilə quraşdırmaq olar:
   ```bash
   brew install node
   ```

3. **Rust və Cargo (Stabil)**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

4. **Rust Target-lər (Apple Silicon və ya Intel üçün)**:
   ```bash
   # Apple Silicon (M1/M2/M3/M4) üçün:
   rustup target add aarch64-apple-darwin

   # Intel prosessorlu Mac-lar üçün:
   rustup target add x86_64-apple-darwin
   ```

---

## 2. Asılılıqların Quraşdırılması

Layihə qovluğuna daxil olun və npm paketlərini yükləyin:

```bash
cd Mintu
npm install
```

---

## 3. İnkişaf Rejimində Başlatma (Development Mode)

Tətbiqi canlı olaraq test etmək və debug rejimində açmaq üçün:

```bash
npm run tauri dev
```

---

## 4. İstehsal Yığımı (Production Build: .dmg və .app)

### Apple Silicon üçün (M1/M2/M3/M4):
```bash
npm run tauri build -- --target aarch64-apple-darwin
```

### Intel prosessorlu Mac-lar üçün:
```bash
npm run tauri build -- --target x86_64-apple-darwin
```

### Cari Mac arxitekturası üçün avtomatik yığım:
```bash
npm run tauri build
```

Hazır yığılmış quraşdırıcılar burada yaranacaq:
- **DMG Quraşdırıcısı**: `src-tauri/target/release/bundle/dmg/`
- **Tətbiq Paketi**: `src-tauri/target/release/bundle/macos/Mintu.app`

---

## 5. Mintu v0.2.4 Əsas İmkanları

1. **Canlı Desktop Pet**: Real cazibə qüvvəsi, tullanma və atılma fizikası ilə masaüstündə sərbəst hərəkət edir. Musiqi oxunarkən fasiləsiz rəqs edir.
2. **3-Tablı Pet Hub**: Qayğı (yemək, çay, sığal), Alətlər (Pomodoro, Quick Note, Clipboard History, Canlı HUD) və Tənzimləmələr (6 dəri, ləqəb, dil seçimi).
3. **Məxfilik və Yüksək Performans**: Sıfır telemetriya, sub-1% CPU istifadəsi və tam yerli yaddaş.
