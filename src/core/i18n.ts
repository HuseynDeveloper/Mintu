export type SupportedLanguage = "az" | "en" | "tr" | "ru";

export interface Translations {
  appName: string;
  howCanIHelp: string;
  typeMessageOrSpeak: string;
  chips: {
    checkTasks: string;
    askAi: string;
    explainCode: string;
    tellJoke: string;
  };
  drawer: {
    conversations: string;
    searchPlaceholder: string;
    newChat: string;
    pin: string;
    delete: string;
    rename: string;
  };
  settings: {
    title: string;
    save: string;
    chat: string;
    close: string;
    activeModel: string;
    downloadModels: string;
    activeModelHint: string;
    systemPersonaPrompt: string;
    systemPersonaHint: string;
    inferenceOptions: string;
    contextTokens: string;
    idleUnload: string;
    hardwareAuto: string;
    whenMintuOutside: string;
    showEmptyPill: string;
    hideIsland: string;
    outsideHint: string;
    walkWindows: string;
    enabled: string;
    disabled: string;
    walkWindowsHint: string;
    windowIgnoreList: string;
    windowIgnoreHint: string;
    privacyBlocklist: string;
    privacyBlocklistHint: string;
    systemStartup: string;
    autoStart: string;
    autoStartHint: string;
    voiceSpeech: string;
    mintuVoice: string;
    mintuVoiceHint: string;
    sttLanguage: string;
    sttLanguageHint: string;
    appLanguage: string;
    appLanguageHint: string;
    gamification: string;
    wardrobe: string;
    productivityUpdates: string;
    smartClipboard: string;
    smartClipboardHint: string;
    mintuVersion: string;
    upToDate: string;
    checkUpdates: string;
    devPanel: string;
    devPanelHint: string;
    diskStorage: string;
  };
  actions: {
    clearChat: string;
    exportMarkdown: string;
    newChat: string;
    allChats: string;
    settings: string;
    collapse: string;
  };
  music: {
    notPlaying: string;
    audioPlayer: string;
    paused: string;
  };
  scratchpad: {
    title: string;
    copy: string;
    copied: string;
    summarize: string;
    summarizing: string;
    clear: string;
    placeholder: string;
    characters: string;
    words: string;
  };
}

export const translations: Record<SupportedLanguage, Translations> = {
  az: {
    appName: "Mintu AI",
    howCanIHelp: "Sizə necə kömək edə bilərəm?",
    typeMessageOrSpeak: "Mesaj yazın və ya danışın...",
    chips: {
      checkTasks: "Tapşırıqları yoxla",
      askAi: "AI-dan soruş",
      explainCode: "Kodu izah et",
      tellJoke: "Zarafat et",
    },
    drawer: {
      conversations: "Söhbətlər",
      searchPlaceholder: "Söhbətləri axtarın...",
      newChat: "Yeni Söhbət",
      pin: "Sancaqla",
      delete: "Sil",
      rename: "Adlandır",
    },
    settings: {
      title: "Tənzimləmələr",
      save: "Yadda saxla",
      chat: "← Söhbət",
      close: "✕ Bağla",
      activeModel: "AKTİV MODEL",
      downloadModels: "+ Modelləri Yüklə",
      activeModelHint: "Mintu-nu işlədən yerli AI modelini seçin.",
      systemPersonaPrompt: "SİSTEM TƏLİMATI (PERSONA)",
      systemPersonaHint: "Mintunun xarakteri və cavab qaydalarını müəyyən edir.",
      inferenceOptions: "İCRA SEÇİMLƏRİ",
      contextTokens: "Kontekst: 2048 token",
      idleUnload: "Boşda boşaltma: 10 dəq",
      hardwareAuto: "Aparat: CPU Avto",
      whenMintuOutside: "MİNTU ÇÖLDƏ OLARKAN (SƏRBƏST REJİM)",
      showEmptyPill: "Boş ada göstər",
      hideIsland: "Adanı gizlət",
      outsideHint: "Mintu masaüstündə gəzərkən adanın görünüşü.",
      walkWindows: "MİNTU PƏNCƏRƏLƏRİN ÜZƏRİNDƏ GƏZSİN",
      enabled: "Aktiv",
      disabled: "Deaktiv",
      walkWindowsHint: "Mintunun açıq tətbiq pəncərələrinin üstündə yeriməsinə icazə verir.",
      windowIgnoreList: "GƏZİLMƏYƏCƏK PROQRAMLAR",
      windowIgnoreHint: "Mintunun üstünə çıxmayacağı proses adları (vergüllə).",
      privacyBlocklist: "MƏXFİ PROQRAMLARIN QARA SİYAHISI",
      privacyBlocklistHint: "Mintu bu proqramlardan heç vaxt mətn və ya ekran oxumayacaq.",
      systemStartup: "SİSTEM VƏ BAŞLANĞIC",
      autoStart: "Windows ilə avtomatik başlasın",
      autoStartHint: "Kompüter açıldıqda Mintu avtomatik arxa fonda işə düşsün.",
      voiceSpeech: "SƏS VƏ NİTQ MÜHƏRRİKİ",
      mintuVoice: "Mintu Səsi (Mətndən-Nitqə)",
      mintuVoiceHint: "Cavabları sinxron mimikalarla səsləndirir.",
      sttLanguage: "SƏSLİ DANIŞIQ DİLİ (STT)",
      sttLanguageHint: "Mikrofon ilə danışılan sözlərin tanınma dili.",
      appLanguage: "TƏTBİQ İNTERFEYS DİLİ (UI)",
      appLanguageHint: "Mintu interfeysinin, düymələrinin və xəbərdarlıqlarının dili.",
      gamification: "OYUNLAŞDIRMA VƏ QARDEROB",
      wardrobe: "MİNTUNUN QARDEROB AKSESUARLARI",
      productivityUpdates: "MƏHSULDARLIQ VƏ YENİLƏNMƏLƏR",
      smartClipboard: "Ağıllı Mübadilə Buferi Köməkçisi",
      smartClipboardHint: "Ctrl+C edildikdə köməkçi düymə göstərir (kod yoxlama, tərcümə).",
      mintuVersion: "Mintu Versiyası v0.2.1",
      upToDate: "Ən son versiyadasınız.",
      checkUpdates: "Yenilənmələri yoxla",
      devPanel: "TƏRTİBATÇI PANELİ (Ctrl+Shift+D)",
      devPanelHint: "Debug pəncərəsini və qrafik qatları aktivləşdirir.",
      diskStorage: "YERLİ MODEL YADDAŞI VƏ DİSK",
    },
    actions: {
      clearChat: "Söhbəti təmizlə",
      exportMarkdown: "Markdown kimi ixrac et",
      newChat: "Yeni söhbət (Ctrl+N)",
      allChats: "Bütün söhbətlər",
      settings: "Tənzimləmələr",
      collapse: "Yığcamlaşdır (Esc)",
    },
    music: {
      notPlaying: "Oxunmur",
      audioPlayer: "Audio Pleyer",
      paused: "Dayandırıldı",
    },
    scratchpad: {
      title: "Sürətli Qeyd (Scratchpad)",
      copy: "Kopyala",
      copied: "Kopyalandı",
      summarize: "AI Xülasə",
      summarizing: "Xülasə edilir...",
      clear: "Təmizlə",
      placeholder: "Fikirlərinizi, qısa qeydlərinizi və ya tapşırıqlarınızı bura yazın (Ctrl+Shift+N)...",
      characters: "simvol",
      words: "söz",
    },
  },
  en: {
    appName: "Mintu AI",
    howCanIHelp: "How can I help you?",
    typeMessageOrSpeak: "Type a message or speak...",
    chips: {
      checkTasks: "Check Tasks",
      askAi: "Ask AI",
      explainCode: "Explain code",
      tellJoke: "Tell a joke",
    },
    drawer: {
      conversations: "Conversations",
      searchPlaceholder: "Search chats...",
      newChat: "New Chat",
      pin: "Pin",
      delete: "Delete",
      rename: "Rename",
    },
    settings: {
      title: "Settings",
      save: "Save",
      chat: "← Chat",
      close: "✕ Close",
      activeModel: "ACTIVE MODEL",
      downloadModels: "+ Download Models",
      activeModelHint: "Choose which local model powers Mintu.",
      systemPersonaPrompt: "SYSTEM PERSONA PROMPT",
      systemPersonaHint: "Defines Mintu's personality and instructions.",
      inferenceOptions: "INFERENCE OPTIONS",
      contextTokens: "Context: 2048 tokens",
      idleUnload: "Idle Unload: 10 mins",
      hardwareAuto: "Hardware: CPU Auto",
      whenMintuOutside: "WHEN MINTU IS OUTSIDE (FREE MODE)",
      showEmptyPill: "Show empty pill",
      hideIsland: "Hide the island",
      outsideHint: "Island appearance while Mintu roams the desktop.",
      walkWindows: "MINTU WALKS ON WINDOWS",
      enabled: "Enabled",
      disabled: "Disabled",
      walkWindowsHint: "Allows Mintu to walk on top of active application windows.",
      windowIgnoreList: "WINDOW WALKING IGNORED APPS",
      windowIgnoreHint: "Comma-separated process names Mintu should not walk on.",
      privacyBlocklist: "PRIVACY APP BLOCKLIST",
      privacyBlocklistHint: "Mintu will never read or capture text/screen from these apps.",
      systemStartup: "SYSTEM & STARTUP CONVENIENCE",
      autoStart: "Auto-start with Windows",
      autoStartHint: "Launch Mintu automatically in background when PC boots.",
      voiceSpeech: "VOICE & SPEECH ENGINE",
      mintuVoice: "Mintu Voice (Text-to-Speech)",
      mintuVoiceHint: "Speaks answers aloud with synchronized pet animations.",
      sttLanguage: "VOICE RECOGNITION LANGUAGE (STT)",
      sttLanguageHint: "Target language for microphone speech input.",
      appLanguage: "APP INTERFACE LANGUAGE (UI)",
      appLanguageHint: "Primary language for Mintu interface, buttons, and notifications.",
      gamification: "GAMIFICATION & WARDROBE",
      wardrobe: "MINTU'S WARDROBE ACCESSORIES",
      productivityUpdates: "SMART PRODUCTIVITY & UPDATES",
      smartClipboard: "Smart Clipboard Assistant",
      smartClipboardHint: "Shows quick action pill on Ctrl+C (code check, translation).",
      mintuVersion: "Mintu Version v0.2.1",
      upToDate: "Up to date with GitHub Releases.",
      checkUpdates: "Check Updates",
      devPanel: "DEVELOPER PANEL (Ctrl+Shift+D)",
      devPanelHint: "Enables debug overlay and hit-test visualizer.",
      diskStorage: "LOCAL MODEL STORAGE & DISK",
    },
    actions: {
      clearChat: "Clear conversation",
      exportMarkdown: "Export to Markdown",
      newChat: "New chat (Ctrl+N)",
      allChats: "All chats",
      settings: "Settings",
      collapse: "Collapse (Esc)",
    },
    music: {
      notPlaying: "Not Playing",
      audioPlayer: "Audio Player",
      paused: "Paused",
    },
    scratchpad: {
      title: "Quick Scratchpad",
      copy: "Copy",
      copied: "Copied",
      summarize: "AI Summarize",
      summarizing: "Summarizing...",
      clear: "Clear",
      placeholder: "Write your thoughts, quick notes or tasks here (Ctrl+Shift+N)...",
      characters: "characters",
      words: "words",
    },
  },
  tr: {
    appName: "Mintu AI",
    howCanIHelp: "Size nasıl yardımcı olabilirim?",
    typeMessageOrSpeak: "Bir mesaj yazın veya konuşun...",
    chips: {
      checkTasks: "Görevleri Kontrol Et",
      askAi: "Yapay Zekaya Sor",
      explainCode: "Kodu Açıkla",
      tellJoke: "Şaka Yap",
    },
    drawer: {
      conversations: "Sohbetler",
      searchPlaceholder: "Sohbetlerde ara...",
      newChat: "Yeni Sohbet",
      pin: "Sabitle",
      delete: "Sil",
      rename: "Yeniden Adlandır",
    },
    settings: {
      title: "Ayarlar",
      save: "Kaydet",
      chat: "← Sohbet",
      close: "✕ Kapat",
      activeModel: "AKTİF MODEL",
      downloadModels: "+ Modelleri İndir",
      activeModelHint: "Mintu'yu çalıştıran yerel modeli seçin.",
      systemPersonaPrompt: "SİSTEM PERSONA İSTEMİ",
      systemPersonaHint: "Mintu'nun kişiliğini ve talimatlarını belirler.",
      inferenceOptions: "ÇIKARIM SEÇENEKLERİ",
      contextTokens: "Bağlam: 2048 token",
      idleUnload: "Boşta boşalt: 10 dk",
      hardwareAuto: "Donanım: CPU Otomatik",
      whenMintuOutside: "MİNTU DIŞARIDAYKEN (SERBEST MOD)",
      showEmptyPill: "Boş ada göster",
      hideIsland: "Adayı gizle",
      outsideHint: "Mintu masaüstünde gezerken adanın görünümü.",
      walkWindows: "MİNTU PENCERELERDE GEZSİN",
      enabled: "Etkin",
      disabled: "Devre dışı",
      walkWindowsHint: "Mintu'nun açık uygulama pencerelerinde yürümesine izin verir.",
      windowIgnoreList: "YÜRÜNMEYECEK UYGULAMALAR",
      windowIgnoreHint: "Mintu'nun çıkmayacağı işlem adları (virgülle).",
      privacyBlocklist: "GİZLİLİK UYGULAMA KARA LİSTESİ",
      privacyBlocklistHint: "Mintu bu uygulamalardan asla metin/ekran okumaz.",
      systemStartup: "SİSTEM VE BAŞLANGIÇ",
      autoStart: "Windows ile otomatik başlat",
      autoStartHint: "Bilgisayar açıldığında Mintu arka planda başlasın.",
      voiceSpeech: "SES VE KONUŞMA MOTORU",
      mintuVoice: "Mintu Sesi (Metinden-Sese)",
      mintuVoiceHint: "Cevapları animasyonla senkronize seslendirir.",
      sttLanguage: "SES TANIMA DİLİ (STT)",
      sttLanguageHint: "Mikrofon ses girişi hedef dili.",
      appLanguage: "UYGULAMA ARAYÜZ DİLİ (UI)",
      appLanguageHint: "Mintu arayüzü ve butonlarının ana dili.",
      gamification: "OYUNLAŞTIRMA VE DOLAP",
      wardrobe: "MİNTU'NUN DOLAP AKSESUARLARI",
      productivityUpdates: "AKILLI VERİMLİLİK VE GÜNCELLEMELER",
      smartClipboard: "Akıllı Pano Asistanı",
      smartClipboardHint: "Ctrl+C yapıldığında hızlı işlem hapı gösterir.",
      mintuVersion: "Mintu Sürümü v0.2.1",
      upToDate: "En son sürümdesiniz.",
      checkUpdates: "Güncellemeleri Kontrol Et",
      devPanel: "GELİŞTİRİCİ PANELİ (Ctrl+Shift+D)",
      devPanelHint: "Hata ayıklama kaplamasını etkinleştirir.",
      diskStorage: "YEREL MODEL DEPOLAMA VE DİSK",
    },
    actions: {
      clearChat: "Sohbeti temizle",
      exportMarkdown: "Markdown olarak dışa aktar",
      newChat: "Yeni sohbet (Ctrl+N)",
      allChats: "Tüm sohbetler",
      settings: "Ayarlar",
      collapse: "Daralt (Esc)",
    },
    music: {
      notPlaying: "Çalmıyor",
      audioPlayer: "Ses Çalar",
      paused: "Duraklatıldı",
    },
    scratchpad: {
      title: "Hızlı Karalama (Scratchpad)",
      copy: "Kopyala",
      copied: "Kopyalandı",
      summarize: "AI Özetle",
      summarizing: "Özetleniyor...",
      clear: "Temizle",
      placeholder: "Fikirlerinizi, hızlı notlarınızı veya görevlerinizi buraya yazın (Ctrl+Shift+N)...",
      characters: "karakter",
      words: "kelime",
    },
  },
  ru: {
    appName: "Mintu AI",
    howCanIHelp: "Чем я могу вам помочь?",
    typeMessageOrSpeak: "Введите сообщение или говорите...",
    chips: {
      checkTasks: "Проверить задачи",
      askAi: "Спросить AI",
      explainCode: "Объяснить код",
      tellJoke: "Рассказать шутку",
    },
    drawer: {
      conversations: "Беседы",
      searchPlaceholder: "Поиск бесед...",
      newChat: "Новый чат",
      pin: "Закрепить",
      delete: "Удалить",
      rename: "Переименовать",
    },
    settings: {
      title: "Настройки",
      save: "Сохранить",
      chat: "← Чат",
      close: "✕ Закрыть",
      activeModel: "АКТИВНАЯ МОДЕЛЬ",
      downloadModels: "+ Скачать модели",
      activeModelHint: "Локальная модель для работы Mintu.",
      systemPersonaPrompt: "СИСТЕМНЫЙ ПРОМПТ (ПЕРСОНА)",
      systemPersonaHint: "Определяет характер и инструкции Mintu.",
      inferenceOptions: "ПАРАМЕТРЫ ВЫВОДА",
      contextTokens: "Контекст: 2048 токенов",
      idleUnload: "Выгрузка при простое: 10 мин",
      hardwareAuto: "Оборудование: CPU Авто",
      whenMintuOutside: "КОГДА МИНТУ СНАРУЖИ (СВОБОДНЫЙ РЕЖИМ)",
      showEmptyPill: "Показывать пустую капсулу",
      hideIsland: "Скрывать остров",
      outsideHint: "Вид островка, когда Минту гуляет по рабочему столу.",
      walkWindows: "МИНТУ ГУЛЯЕТ ПО ОКНАМ",
      enabled: "Включено",
      disabled: "Отключено",
      walkWindowsHint: "Позволяет Минту ходить по открытым окнам приложений.",
      windowIgnoreList: "СПИСОК ИГНОРИРУЕМЫХ ОКОН",
      windowIgnoreHint: "Имена процессов, по которым Минту не ходит (через запятую).",
      privacyBlocklist: "ЧЕРНЫЙ СПИСОК КОНФИДЕНЦИАЛЬНОСТИ",
      privacyBlocklistHint: "Минту никогда не читает экран и текст из этих приложений.",
      systemStartup: "СИСТЕМА И АВТОЗАПУСК",
      autoStart: "Автозапуск с Windows",
      autoStartHint: "Запускать Mintu в фоне при загрузке компьютера.",
      voiceSpeech: "ГОЛОС И РЕЧЬ",
      mintuVoice: "Голос Минту (Text-to-Speech)",
      mintuVoiceHint: "Озвучивает ответы с синхронной анимацией рта.",
      sttLanguage: "ЯЗЫК РАСПОЗНАВАНИЯ РЕЧИ (STT)",
      sttLanguageHint: "Язык ввода с микрофона.",
      appLanguage: "ЯЗЫК ИНТЕРФЕЙСА (UI)",
      appLanguageHint: "Основной язык интерфейса и кнопок Mintu.",
      gamification: "ГЕЙМИФИКАЦИЯ И ГАРДЕРОБ",
      wardrobe: "АКСЕССУАРЫ МИНТУ",
      productivityUpdates: "ПРОДУКТИВНОСТЬ И ОБНОВЛЕНИЯ",
      smartClipboard: "Умный буфер обмена",
      smartClipboardHint: "Показывает плашку действий при Ctrl+C (код, перевод).",
      mintuVersion: "Версия Mintu v0.2.1",
      upToDate: "Установлена актуальная версия.",
      checkUpdates: "Проверить обновления",
      devPanel: "ПАНЕЛЬ РАЗРАБОТЧИКА (Ctrl+Shift+D)",
      devPanelHint: "Включает оверлей отладки.",
      diskStorage: "ЛОКАЛЬНОЕ ХРАНИЛИЩЕ МОДЕЛЕЙ",
    },
    actions: {
      clearChat: "Очистить беседу",
      exportMarkdown: "Экспорт в Markdown",
      newChat: "Новый чат (Ctrl+N)",
      allChats: "Все беседы",
      settings: "Настройки",
      collapse: "Свернуть (Esc)",
    },
    music: {
      notPlaying: "Не играет",
      audioPlayer: "Аудиоплеер",
      paused: "Приостановлено",
    },
    scratchpad: {
      title: "Быстрый блокнот (Scratchpad)",
      copy: "Копировать",
      copied: "Скопировано",
      summarize: "AI Саммари",
      summarizing: "Обобщение...",
      clear: "Очистить",
      placeholder: "Записывайте мысли, заметки или задачи (Ctrl+Shift+N)...",
      characters: "символов",
      words: "слов",
    },
  },
};

export class I18nManager {
  private currentLang: SupportedLanguage = "az";

  constructor() {
    const saved = typeof localStorage !== "undefined" ? (localStorage.getItem("mintu_ui_language") as SupportedLanguage) : null;
    if (saved && translations[saved]) {
      this.currentLang = saved;
    } else {
      this.currentLang = "az";
    }
  }

  public getLang(): SupportedLanguage {
    return this.currentLang;
  }

  public setLang(lang: SupportedLanguage): void {
    if (translations[lang]) {
      this.currentLang = lang;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("mintu_ui_language", lang);
      }
    }
  }

  public t(): Translations {
    return translations[this.currentLang] || translations.az;
  }
}

export const i18n = new I18nManager();
