# Mintu — Chrome Extension (Living Companion)

Mintu masaüstü proqramından tamamilə təcrid olunmuş şəkildə hazırlanmış rəsmi Google Chrome Extension.

---

## Əsas Xüsusiyyətlər
1. **Dynamic Island Yan Panel (Side Panel)**:
   - Chrome-un sağ tərəfində açılan müasir Dynamic Island interfeysi.
   - Sual-cavab, kodlaşdırma və canlı streaming cavablar.
2. **Səhifə Analizi və Xülasə**:
   - `Summarize page`: Açdığınız veb səhifənin mətnini dərhal təhlil edib xülasələndirir.
   - `Key points`: Səhifənin ən vacib 5 fikrini çıxarır.
   - `Translate selection`: İstənilən mətni Azərbaycan dilinə tərcümə edir.
3. **Seçilmiş Mətn Köməkçisi (Quick Selection Pill)**:
   - Saytda hər hansı mətni seçdikdə yanında "Ask Mintu" düyməsi görünür, kliklədikdə dərhal izah edir.
4. **Gəzən Ev Heyvanı (Floating Companion)**:
   - Veb səhifələrin üzərində gəzən, sürüklənə bilən (drag & drop) Mintu.
   - Yan paneldəki düymə ilə istədiyiniz vaxt açıb-bağlaya bilərsiniz.
5. **İstənilən LLM / API Dəstəyi**:
   - **Google Gemini**: Standart `gemini-2.5-flash` (istəyə görə dəyişdirilə bilər).
   - **OpenAI**: `gpt-4o`, `gpt-4o-mini`.
   - **DeepSeek**: `deepseek-chat`.
   - **Xüsusi Linklər (Custom Endpoint)**: Ollama (`http://localhost:11434/v1`), Groq və ya istədiyiniz OpenAI-uyğun istənilən Base URL və Model kodu.

---

## Quraşdırılma Qaydası (Addım-addım)

1. **Google Chrome** brauzerini açın.
2. Ünvan sətrinə yazın və Enter basın:
   ```text
   chrome://extensions
   ```
3. Yuxarı sağ küncdəki **"Developer mode"** açarını aktiv edin.
4. Yuxarı solda çıxan **"Load unpacked"** düyməsinə klikləyin.
5. Açılan qovluq pəncərəsində bu qovluğu seçin:
   ```text
   c:\Users\TT_S\OneDrive\Desktop\Mintu\chrome-extension
   ```
6. **Mintu — Living Companion** dərhal Chrome genişlənmələri sırasına əlavə olunacaq.

---

## API Açarının Qeyd Edilməsi
1. Chrome-un yuxarı sağındakı genişlənmələr ikonundan (və ya yan paneldən) **Mintu**-nu açın.
2. Yuxarı sağdakı **Parametrlər** düyməsinə klikləyin.
3. **Google Gemini API Key** daxil edin.
4. **Yadda Saxla** düyməsinə basın.

---

## Təhlükəsizlik və Təcrid
Bu genişlənmə masaüstü `mintu.exe` tətbiqindən tam müstəqil işləyir. Heç bir sistem faylını dəyişdirmir və API açarlarınızı yalnız brauzerinizin yerli yaddaşında (`chrome.storage.local`) saxlayır.
