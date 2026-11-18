export type SupportedLanguage = "az" | "en" | "tr" | "ru";

export interface PetHubTranslations {
  focusTimer: string;
  start: string;
  pause: string;
  resume: string;
  reset: string;
  energy: string;
  happiness: string;
  feedCookie: string;
  giveTea: string;
  patMintu: string;
  dance: string;
  sleep: string;
  chaseCursor: string;
  stopChase: string;
  desktopMode: string;
  dailyTip: string;
  quickNote: string;
  fileShelf: string;
  nowPlaying: string;
  focusStat: string;
  xpToday: string;
  streak: string;
  ambientTitle: string;
  ambientOff: string;
  ambientRain: string;
  ambientFireplace: string;
  ambientBrown: string;
  ambientWhite: string;
  shelfTitle: string;
  shelfDropHint: string;
  shelfEmpty: string;
  shelfOpen: string;
  shelfReveal: string;
  shelfCopy: string;
  shelfCopied: string;
  shelfClear: string;
  volumeLabel: string;
  volumeMuted: string;
  skinsTitle: string;
  moodReactions: string;
  quietMode: string;
  walkWindows: string;
  cuteSounds: string;
  autostart: string;
  islandWhenFree: string;
  miniPill: string;
  hideIsland: string;
  weatherToggle: string;
  weatherCityPlaceholder: string;
  weatherSave: string;
  devPanel: string;
  cookieFedMsg: string;
  teaGivenMsg: string;
  chaseStartedMsg: string;
  chaseStoppedMsg: string;
  weatherConditions: {
    clear: string;
    cloudy: string;
    rain: string;
    snow: string;
    storm: string;
    fog: string;
  };
  tabPet: string;
  tabTools: string;
  tabSettings: string;
  waterTitle: string;
  waterDrink: string;
  waterRemTitle: string;
  waterRemText: string;
  quickCalcPlaceholder: string;
  todosTitle: string;
  todoPlaceholder: string;
  todoAdd: string;
  remindersTitle: string;
  reminderPlaceholder: string;
  reminderAdd: string;
  clipboardTitle: string;
  clipboardEmpty: string;
  clipboardPin: string;
  clipboardClear: string;
  colorPicker: string;
  colorCopied: string;
  dropStar: string;
  starsCaught: string;
  deviceConnected: string;
  deviceDisconnected: string;
  audioDevice: string;
  usbDevice: string;
  brightnessLabel: string;
  capsOn: string;
  capsOff: string;
  numOn: string;
  numOff: string;
  netDisconnected: string;
  netReconnected: string;
  petNameLabel: string;
  petNameSave: string;
  bongoTyping: string;
  fullscreenAutoHide: string;
  hourlyChime: string;
  netSpeedPill: string;
  monitorSelect: string;
  waterIntervalLabel: string;
  eyeBreak2020: string;
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  greetingNight: string;
  tips: string[];
}

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
    wardrobeDesc: string;
    wardrobeItems: {
      none: string;
      glasses: string;
      coffee_cup: string;
      winter_hat: string;
      headphones: string;
    };
    wardrobeStatus: {
      equipped: string;
      equip: string;
      unlocksAt: string;
    };
    xpStatsHint: string;
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
    modelDownloads: string;
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
  petHub: PetHubTranslations;
}

export const translations: Record<SupportedLanguage, Translations> = {
  az: {
    appName: "Mintu",
    howCanIHelp: "Mintu burada!",
    typeMessageOrSpeak: "Qısa qeyd yazın...",
    chips: {
      checkTasks: "Fokus Taymeri",
      askAi: "Pet Hub",
      explainCode: "Sürətli Qeyd",
      tellJoke: "Günün Məsləhəti",
    },
    drawer: {
      conversations: "Fayl Rəfi",
      searchPlaceholder: "Axtar...",
      newChat: "Yeni Qeyd",
      pin: "Sancaqla",
      delete: "Sil",
      rename: "Adlandır",
    },
    settings: {
      title: "Tənzimləmələr",
      save: "Yadda saxla",
      chat: "Hub",
      close: "Bağla",
      activeModel: "STİL",
      downloadModels: "Rənglər",
      activeModelHint: "Mintunun rəng palitrasını seçin.",
      systemPersonaPrompt: "DAVRANIŞ",
      systemPersonaHint: "Mintunun masaüstü davranışlarını tənzimləyin.",
      inferenceOptions: "SEÇİMLƏR",
      contextTokens: "Standart",
      idleUnload: "Yuxu rejimi",
      hardwareAuto: "Avto",
      whenMintuOutside: "MİNTU MASAÜSTÜNDƏ OLARKAN",
      showEmptyPill: "Mini kapsul",
      hideIsland: "Adanı gizlət",
      outsideHint: "Mintu masaüstündə gəzərkən adanın görünüşü.",
      walkWindows: "Pəncərələrin üstündə gəzsin",
      enabled: "Aktiv",
      disabled: "Deaktiv",
      walkWindowsHint: "Mintunun açıq pəncərələrin üstündə yeriməsinə icazə verir.",
      windowIgnoreList: "Gəzilməyəcək proqramlar",
      windowIgnoreHint: "Proses adları (vergüllə).",
      privacyBlocklist: "Məxfilik siyahısı",
      privacyBlocklistHint: "Qorunan pəncərələr.",
      systemStartup: "SİSTEM VƏ BAŞLANĞIC",
      autoStart: "Windows ilə başlasın",
      autoStartHint: "Kompüter açıldıqda Mintu avtomatik işə düşsün.",
      voiceSpeech: "SƏSLƏR",
      mintuVoice: "Şirin səs effektləri",
      mintuVoiceHint: "Mintunun interaktiv səsləri.",
      sttLanguage: "DİL",
      sttLanguageHint: "İnterfeys dili.",
      appLanguage: "İnterfeys dili",
      appLanguageHint: "Mintu interfeysinin dili.",
      gamification: "QARDEROB",
      wardrobe: "MİNTUNUN QARDEROBU",
      wardrobeDesc: "Kilidi açılmış aksesuarı seçin.",
      wardrobeItems: {
        none: "Standart Mintu",
        glasses: "Dəbli Eynək",
        coffee_cup: "İsti Qəhvə",
        winter_hat: "Qış Papağı",
        headphones: "Fokus Qulaqlıq",
      },
      wardrobeStatus: {
        equipped: "İstifadədədir",
        equip: "Tax",
        unlocksAt: "Lvl {lvl}-də açılır",
      },
      xpStatsHint: "{pomodoros} Pomodoro tamamlandı, {minutes} fokus dəqiqəsi qazanıldı.",
      productivityUpdates: "YENİLƏNMƏLƏR",
      smartClipboard: "Ağıllı bufer",
      smartClipboardHint: "JSON formatlayıcı.",
      mintuVersion: "Mintu v0.2.4",
      upToDate: "Ən son versiyadasınız.",
      checkUpdates: "Yenilənmə yoxla",
      devPanel: "Debug paneli (Ctrl+Shift+D)",
      devPanelHint: "Tərtibatçı panelini açır.",
      diskStorage: "Yaddaş",
    },
    actions: {
      clearChat: "Təmizlə",
      exportMarkdown: "İxrac et",
      newChat: "Yeni qeyd",
      allChats: "Hamısı",
      settings: "Tənzimləmələr",
      collapse: "Yığcamlaşdır (Esc)",
      modelDownloads: "Rənglər",
    },
    music: {
      notPlaying: "Oxunmur",
      audioPlayer: "Audio Pleyer",
      paused: "Dayandırıldı",
    },
    scratchpad: {
      title: "Sürətli Qeyd",
      copy: "Kopyala",
      copied: "Kopyalandı",
      summarize: "Təmizlə",
      summarizing: "Yadda saxlanır...",
      clear: "Təmizlə",
      placeholder: "Qısa qeydlərinizi bura yazın (avtomatik yadda saxlanır)...",
      characters: "simvol",
      words: "söz",
    },
    petHub: {
      focusTimer: "Fokus Taymeri",
      start: "Başla",
      pause: "Fasilə",
      resume: "Davam et",
      reset: "Sıfırla",
      energy: "Enerji",
      happiness: "Sevinc",
      feedCookie: "Peçenye ver",
      giveTea: "Nanə çayı",
      patMintu: "Sığalla (+5)",
      dance: "Rəqs et",
      sleep: "Yat",
      chaseCursor: "Kursoru qov",
      stopChase: "Qovmanı bitir",
      desktopMode: "Masaüstü",
      dailyTip: "Məsləhət",
      quickNote: "Qeyd",
      fileShelf: "Fayl Rəfi",
      nowPlaying: "İndi Oxunur",
      focusStat: "Fokus",
      xpToday: "Bugünkü XP",
      streak: "Ardıcıllıq",
      ambientTitle: "Fokus Səsləri",
      ambientOff: "Söndür",
      ambientRain: "Yağış",
      ambientFireplace: "Ocaq",
      ambientBrown: "Dərin",
      ambientWhite: "Ağ səs",
      shelfTitle: "Fayl Rəfi",
      shelfDropHint: "Faylları adanın üstünə atın",
      shelfEmpty: "Rəf boşdur. İstənilən faylı yuxarıdakı adaya sürükləyin.",
      shelfOpen: "Aç",
      shelfReveal: "Qovluq",
      shelfCopy: "Yolu kopyala",
      shelfCopied: "Kopyalandı",
      shelfClear: "Təmizlə",
      volumeLabel: "Səs Səviyyəsi",
      volumeMuted: "Səssiz",
      skinsTitle: "Mintu Rəngləri (Skins)",
      moodReactions: "Əhval reaksiyaları",
      quietMode: "Sakit rejim",
      walkWindows: "Pəncərə üstündə gəzsin",
      cuteSounds: "Şirin səs effektləri",
      autostart: "Windows ilə başlasın",
      islandWhenFree: "Mintu çöldə olanda ada",
      miniPill: "Mini kapsul",
      hideIsland: "Adanı gizlət",
      weatherToggle: "Adada canlı hava",
      weatherCityPlaceholder: "Şəhər (məs. Baku)",
      weatherSave: "Yenilə",
      devPanel: "Debug paneli",
      cookieFedMsg: "Dadlı peçenye! Enerji doldu (+8 XP)",
      teaGivenMsg: "İsti nanə çayı! Çox rahatladım (+8 XP)",
      chaseStartedMsg: "Kursoru tutmağa hazıram!",
      chaseStoppedMsg: "Yaxşı, biraz dincəlim.",
      weatherConditions: {
        clear: "Açıq",
        cloudy: "Buludlu",
        rain: "Yağışlı",
        snow: "Qarlı",
        storm: "Fırtına",
        fog: "Dumanlı",
      },
      tabPet: "Pet",
      tabTools: "Alətlər",
      tabSettings: "Ayarlar",
      waterTitle: "Günlük Su",
      waterDrink: "+1 Stəkan",
      waterRemTitle: "Su və Göz Fasiləsi",
      waterRemText: "Bir qurtum su için və 20 saniyə uzağa baxın.",
      quickCalcPlaceholder: "Hesabla: 450*18, 50 usd to azn, 5 km to m",
      todosTitle: "Günlük Tapşırıqlar",
      todoPlaceholder: "Yeni tapşırıq yaz...",
      todoAdd: "Əlavə et",
      remindersTitle: "Xatırladıcı",
      reminderPlaceholder: "Nəyi xatırladım?",
      reminderAdd: "Qur",
      clipboardTitle: "Kopyalama Tarixçəsi",
      clipboardEmpty: "Hələ heç nə kopyalanmayıb (Ctrl+C).",
      clipboardPin: "Sancaq",
      clipboardClear: "Təmizlə",
      colorPicker: "Rəng Seç",
      colorCopied: "Rəng kopyalandı",
      dropStar: "Ulduz At",
      starsCaught: "Ulduzlar",
      deviceConnected: "Qoşuldu",
      deviceDisconnected: "Ayrıldı",
      audioDevice: "Audio Cihaz",
      usbDevice: "USB Cihaz",
      brightnessLabel: "Parlaqlıq",
      capsOn: "CAPS LOCK AÇIQ",
      capsOff: "CAPS LOCK BAĞLI",
      numOn: "NUM LOCK AÇIQ",
      numOff: "NUM LOCK BAĞLI",
      netDisconnected: "İnternet kəsildi",
      netReconnected: "İnternet bərpa olundu",
      petNameLabel: "Pet Adı",
      petNameSave: "Yadda saxla",
      bongoTyping: "Yazarkən Bongo-Cat reaksiyası",
      fullscreenAutoHide: "Tam ekranda (oyun/video) gizlən",
      hourlyChime: "Saat başı zərif zəng",
      netSpeedPill: "Adada canlı internet sürəti",
      monitorSelect: "Aktiv Monitor",
      waterIntervalLabel: "Su xatırladıcı (dəq)",
      eyeBreak2020: "20-20-20 Göz dincəltmə",
      greetingMorning: "Sabahın xeyir!",
      greetingAfternoon: "Günortan xeyir!",
      greetingEvening: "Axşamın xeyir!",
      greetingNight: "Gecən xeyir, biraz dincəl!",
      tips: [
        "Bir stəkan su için və çiyinlərinizi biraz dincəldin.",
        "Adanın üstünə 2 dəfə basaraq Mintunu masaüstünə çıxara bilərsiniz.",
        "İstənilən faylı yuxarıdakı adaya sürükləyib Fayl Rəfində saxlayın.",
        "Musiqi açın, adaya klikləyib Now Playing Pro kartını açın.",
        "25 dəqiqəlik Fokus Taymeri ilə XP qazanıb yeni aksesuarlar açın.",
      ],
    },
  },
  en: {
    appName: "Mintu",
    howCanIHelp: "Mintu is here!",
    typeMessageOrSpeak: "Write a quick note...",
    chips: {
      checkTasks: "Focus Timer",
      askAi: "Pet Hub",
      explainCode: "Quick Note",
      tellJoke: "Daily Tip",
    },
    drawer: {
      conversations: "File Shelf",
      searchPlaceholder: "Search...",
      newChat: "New Note",
      pin: "Pin",
      delete: "Delete",
      rename: "Rename",
    },
    settings: {
      title: "Settings",
      save: "Save",
      chat: "Hub",
      close: "Close",
      activeModel: "STYLE",
      downloadModels: "Skins",
      activeModelHint: "Pick Mintu's color palette.",
      systemPersonaPrompt: "BEHAVIOR",
      systemPersonaHint: "Configure Mintu's desktop behaviors.",
      inferenceOptions: "OPTIONS",
      contextTokens: "Standard",
      idleUnload: "Sleep mode",
      hardwareAuto: "Auto",
      whenMintuOutside: "WHEN MINTU IS OUTSIDE",
      showEmptyPill: "Mini Pill",
      hideIsland: "Hide Island",
      outsideHint: "Island appearance while Mintu roams the desktop.",
      walkWindows: "Walk on Open Windows",
      enabled: "Enabled",
      disabled: "Disabled",
      walkWindowsHint: "Allows Mintu to walk on top of open application windows.",
      windowIgnoreList: "Ignored Apps",
      windowIgnoreHint: "Comma-separated process names.",
      privacyBlocklist: "Privacy List",
      privacyBlocklistHint: "Protected windows.",
      systemStartup: "SYSTEM & STARTUP",
      autoStart: "Launch on Windows Startup",
      autoStartHint: "Launch Mintu automatically when PC boots.",
      voiceSpeech: "AUDIO",
      mintuVoice: "Cute Sound Effects",
      mintuVoiceHint: "Interactive chirps and chimes.",
      sttLanguage: "LANGUAGE",
      sttLanguageHint: "Interface language.",
      appLanguage: "Language",
      appLanguageHint: "Primary interface language for Mintu.",
      gamification: "WARDROBE",
      wardrobe: "MINTU'S WARDROBE",
      wardrobeDesc: "Select any unlocked accessory for Mintu.",
      wardrobeItems: {
        none: "Standard Mintu",
        glasses: "Stylish Glasses",
        coffee_cup: "Hot Coffee",
        winter_hat: "Winter Beanie",
        headphones: "Focus Headphones",
      },
      wardrobeStatus: {
        equipped: "Equipped",
        equip: "Equip",
        unlocksAt: "Unlocks at Lvl {lvl}",
      },
      xpStatsHint: "{pomodoros} Pomodoros completed, {minutes} focus minutes earned.",
      productivityUpdates: "UPDATES",
      smartClipboard: "Smart Clipboard",
      smartClipboardHint: "Quick JSON formatter.",
      mintuVersion: "Mintu v0.2.4",
      upToDate: "Up to date.",
      checkUpdates: "Check Updates",
      devPanel: "Developer Debug Panel",
      devPanelHint: "Enables debug overlay.",
      diskStorage: "Storage",
    },
    actions: {
      clearChat: "Clear",
      exportMarkdown: "Export",
      newChat: "New Note",
      allChats: "All",
      settings: "Settings",
      collapse: "Collapse (Esc)",
      modelDownloads: "Skins",
    },
    music: {
      notPlaying: "Not Playing",
      audioPlayer: "Audio Player",
      paused: "Paused",
    },
    scratchpad: {
      title: "Quick Note",
      copy: "Copy",
      copied: "Copied",
      summarize: "Clear",
      summarizing: "Saving...",
      clear: "Clear",
      placeholder: "Write a quick note... (auto-saved)",
      characters: "chars",
      words: "words",
    },
    petHub: {
      focusTimer: "Focus Timer",
      start: "Start",
      pause: "Pause",
      resume: "Resume",
      reset: "Reset",
      energy: "Energy",
      happiness: "Happiness",
      feedCookie: "Cookie",
      giveTea: "Mint Tea",
      patMintu: "Pat (+5 XP)",
      dance: "Dance",
      sleep: "Sleep",
      chaseCursor: "Chase Cursor",
      stopChase: "Stop Chase",
      desktopMode: "Desktop Mode",
      dailyTip: "Daily Tip",
      quickNote: "Quick Note",
      fileShelf: "File Shelf",
      nowPlaying: "Now Playing",
      focusStat: "Focus",
      xpToday: "XP Today",
      streak: "Streak",
      ambientTitle: "Focus Sounds",
      ambientOff: "Off",
      ambientRain: "Rain",
      ambientFireplace: "Fireplace",
      ambientBrown: "Brown",
      ambientWhite: "White",
      shelfTitle: "Notch File Shelf",
      shelfDropHint: "Drop files onto the island",
      shelfEmpty: "Shelf is empty. Drag any file onto the top island to hold it here.",
      shelfOpen: "Open",
      shelfReveal: "Folder",
      shelfCopy: "Copy Path",
      shelfCopied: "Copied",
      shelfClear: "Clear All",
      volumeLabel: "Volume",
      volumeMuted: "Muted",
      skinsTitle: "Pet Skins",
      moodReactions: "Pet Mood Reactions",
      quietMode: "Quiet Mode",
      walkWindows: "Walk on Open Windows",
      cuteSounds: "Cute Sound Effects",
      autostart: "Launch on Windows Startup",
      islandWhenFree: "Island When Pet Is Free",
      miniPill: "Mini Pill",
      hideIsland: "Hide Island",
      weatherToggle: "Live Weather in Pill",
      weatherCityPlaceholder: "City (e.g. Baku)",
      weatherSave: "Update",
      devPanel: "Developer Debug Panel",
      cookieFedMsg: "Yummy cookie! Energy boosted (+8 XP)",
      teaGivenMsg: "Warm mint tea! Feeling refreshed (+8 XP)",
      chaseStartedMsg: "Ready to chase your cursor!",
      chaseStoppedMsg: "Okay, taking a little breather.",
      weatherConditions: {
        clear: "Clear",
        cloudy: "Cloudy",
        rain: "Rain",
        snow: "Snow",
        storm: "Storm",
        fog: "Fog",
      },
      tabPet: "Pet",
      tabTools: "Tools",
      tabSettings: "Settings",
      waterTitle: "Daily Water",
      waterDrink: "+1 Glass",
      waterRemTitle: "Water & Eye Break",
      waterRemText: "Take a sip of water and rest your eyes for 20 seconds.",
      quickCalcPlaceholder: "Calc: 450*18, 50 usd to azn, 5 km to m",
      todosTitle: "Daily Tasks",
      todoPlaceholder: "Add a quick task...",
      todoAdd: "Add",
      remindersTitle: "Reminder",
      reminderPlaceholder: "Remind me to...",
      reminderAdd: "Set",
      clipboardTitle: "Clipboard History",
      clipboardEmpty: "Nothing copied yet (Ctrl+C).",
      clipboardPin: "Pin",
      clipboardClear: "Clear",
      colorPicker: "Color Picker",
      colorCopied: "Color copied",
      dropStar: "Drop Star",
      starsCaught: "Stars",
      deviceConnected: "Connected",
      deviceDisconnected: "Disconnected",
      audioDevice: "Audio Device",
      usbDevice: "USB Device",
      brightnessLabel: "Brightness",
      capsOn: "CAPS LOCK ON",
      capsOff: "CAPS LOCK OFF",
      numOn: "NUM LOCK ON",
      numOff: "NUM LOCK OFF",
      netDisconnected: "Internet disconnected",
      netReconnected: "Internet reconnected",
      petNameLabel: "Pet Name",
      petNameSave: "Save",
      bongoTyping: "Bongo-Cat Typing Reaction",
      fullscreenAutoHide: "Auto-Hide in Fullscreen",
      hourlyChime: "Gentle Hourly Chime",
      netSpeedPill: "Live Network Speed in Pill",
      monitorSelect: "Active Monitor",
      waterIntervalLabel: "Water Reminder (min)",
      eyeBreak2020: "20-20-20 Eye Break",
      greetingMorning: "Good morning!",
      greetingAfternoon: "Good afternoon!",
      greetingEvening: "Good evening!",
      greetingNight: "Late night cozy mode!",
      tips: [
        "Drink a glass of water and relax your shoulders for a moment.",
        "Double-click the island to bring Mintu onto your desktop.",
        "Drag any file onto the top island to park it in your File Shelf.",
        "Click the playing music pill to open the Now Playing Pro card.",
        "Complete a 25-minute Focus Timer to earn XP and unlock accessories.",
      ],
    },
  },
  tr: {
    appName: "Mintu",
    howCanIHelp: "Mintu burada!",
    typeMessageOrSpeak: "Hızlı not yazın...",
    chips: {
      checkTasks: "Odak Zamanlayıcı",
      askAi: "Pet Merkezi",
      explainCode: "Hızlı Not",
      tellJoke: "Günün İpucu",
    },
    drawer: {
      conversations: "Dosya Rafı",
      searchPlaceholder: "Ara...",
      newChat: "Yeni Not",
      pin: "Sabitle",
      delete: "Sil",
      rename: "Adlandır",
    },
    settings: {
      title: "Ayarlar",
      save: "Kaydet",
      chat: "Merkez",
      close: "Kapat",
      activeModel: "STİL",
      downloadModels: "Temalar",
      activeModelHint: "Mintu'nun renk paletini seçin.",
      systemPersonaPrompt: "DAVRANIŞ",
      systemPersonaHint: "Mintu'nun masaüstü davranışlarını ayarlayın.",
      inferenceOptions: "SEÇENEKLER",
      contextTokens: "Standart",
      idleUnload: "Uyku modu",
      hardwareAuto: "Oto",
      whenMintuOutside: "MİNTU MASAÜSTÜNDEYKEN",
      showEmptyPill: "Mini kapsül",
      hideIsland: "Adayı gizle",
      outsideHint: "Mintu masaüstünde gezerken adanın görünümü.",
      walkWindows: "Pencerelerde Gezsin",
      enabled: "Etkin",
      disabled: "Devre dışı",
      walkWindowsHint: "Mintu'nun açık pencerelerin üstünde yürümesine izin verir.",
      windowIgnoreList: "Hariç Uygulamalar",
      windowIgnoreHint: "Virgülle ayrılmış işlem adları.",
      privacyBlocklist: "Gizlilik Listesi",
      privacyBlocklistHint: "Korunan pencereler.",
      systemStartup: "SİSTEM VE BAŞLANGIÇ",
      autoStart: "Windows ile Başlat",
      autoStartHint: "Bilgisayar açıldığında Mintu otomatik başlasın.",
      voiceSpeech: "SESLER",
      mintuVoice: "Sevimli Ses Efektleri",
      mintuVoiceHint: "Etkileşimli sesler.",
      sttLanguage: "DİL",
      sttLanguageHint: "Arayüz dili.",
      appLanguage: "Dil",
      appLanguageHint: "Mintu arayüz dili.",
      gamification: "DOLAP",
      wardrobe: "MİNTU'NUN DOLABI",
      wardrobeDesc: "Açılmış bir aksesuar seçin.",
      wardrobeItems: {
        none: "Standart Mintu",
        glasses: "Şık Gözlük",
        coffee_cup: "Sıcak Kahve",
        winter_hat: "Kış Şapkası",
        headphones: "Odak Kulaklığı",
      },
      wardrobeStatus: {
        equipped: "Kullanılıyor",
        equip: "Kuşan",
        unlocksAt: "Lvl {lvl}'de açılır",
      },
      xpStatsHint: "{pomodoros} Pomodoro tamamlandı, {minutes} odaklanma dakikası kazanıldı.",
      productivityUpdates: "GÜNCELLEMELER",
      smartClipboard: "Akıllı Pano",
      smartClipboardHint: "Hızlı JSON biçimlendirici.",
      mintuVersion: "Mintu v0.2.4",
      upToDate: "Güncel.",
      checkUpdates: "Güncelleme Kontrol Et",
      devPanel: "Geliştirici Paneli",
      devPanelHint: "Hata ayıklama panelini açar.",
      diskStorage: "Depolama",
    },
    actions: {
      clearChat: "Temizle",
      exportMarkdown: "Dışa aktar",
      newChat: "Yeni Not",
      allChats: "Tümü",
      settings: "Ayarlar",
      collapse: "Daralt (Esc)",
      modelDownloads: "Temalar",
    },
    music: {
      notPlaying: "Çalmıyor",
      audioPlayer: "Ses Çalar",
      paused: "Duraklatıldı",
    },
    scratchpad: {
      title: "Hızlı Not",
      copy: "Kopyala",
      copied: "Kopyalandı",
      summarize: "Temizle",
      summarizing: "Kaydediliyor...",
      clear: "Temizle",
      placeholder: "Hızlı notunuzu buraya yazın (otomatik kaydedilir)...",
      characters: "karakter",
      words: "kelime",
    },
    petHub: {
      focusTimer: "Odak Zamanlayıcı",
      start: "Başlat",
      pause: "Duraklat",
      resume: "Devam",
      reset: "Sıfırla",
      energy: "Enerji",
      happiness: "Mutluluk",
      feedCookie: "Kurabiye",
      giveTea: "Nane Çayı",
      patMintu: "Sev (+5 XP)",
      dance: "Dans Et",
      sleep: "Uyu",
      chaseCursor: "İmleci Kovala",
      stopChase: "Kovalamayı Durdur",
      desktopMode: "Masaüstü",
      dailyTip: "İpucu",
      quickNote: "Hızlı Not",
      fileShelf: "Dosya Rafı",
      nowPlaying: "Şimdi Çalıyor",
      focusStat: "Odak",
      xpToday: "Bugünkü XP",
      streak: "Seri",
      ambientTitle: "Odak Sesleri",
      ambientOff: "Kapalı",
      ambientRain: "Yağmur",
      ambientFireplace: "Şömine",
      ambientBrown: "Derin",
      ambientWhite: "Beyaz",
      shelfTitle: "Dosya Rafı",
      shelfDropHint: "Dosyaları adaya bırakın",
      shelfEmpty: "Raf boş. Herhangi bir dosyayı yukarıdaki adaya sürükleyip bırakın.",
      shelfOpen: "Aç",
      shelfReveal: "Klasör",
      shelfCopy: "Yolu Kopyala",
      shelfCopied: "Kopyalandı",
      shelfClear: "Temizle",
      volumeLabel: "Ses Seviyesi",
      volumeMuted: "Sessiz",
      skinsTitle: "Mintu Temaları (Skins)",
      moodReactions: "Ruh Hali Tepkileri",
      quietMode: "Sessiz Mod",
      walkWindows: "Pencerelerde Gezsin",
      cuteSounds: "Sevimli Ses Efektleri",
      autostart: "Windows ile Başlat",
      islandWhenFree: "Mintu Dışarıdayken Ada",
      miniPill: "Mini Kapsül",
      hideIsland: "Adayı Gizle",
      weatherToggle: "Adada Canlı Hava",
      weatherCityPlaceholder: "Şehir (örn. Baku)",
      weatherSave: "Güncelle",
      devPanel: "Geliştirici Paneli",
      cookieFedMsg: "Nefis kurabiye! Enerji doldu (+8 XP)",
      teaGivenMsg: "Sıcak nane çayı! Çok rahatladım (+8 XP)",
      chaseStartedMsg: "İmleci yakalamaya hazırım!",
      chaseStoppedMsg: "Tamam, biraz dinleneyim.",
      weatherConditions: {
        clear: "Açık",
        cloudy: "Bulutlu",
        rain: "Yağmurlu",
        snow: "Karlı",
        storm: "Fırtına",
        fog: "Sisli",
      },
      tabPet: "Pet",
      tabTools: "Araçlar",
      tabSettings: "Ayarlar",
      waterTitle: "Günlük Su",
      waterDrink: "+1 Bardak",
      waterRemTitle: "Su ve Göz Molası",
      waterRemText: "Bir yudum su için ve gözlerinizi 20 saniye dinlendirin.",
      quickCalcPlaceholder: "Hesapla: 450*18, 50 usd to azn, 5 km to m",
      todosTitle: "Günlük Görevler",
      todoPlaceholder: "Yeni görev yaz...",
      todoAdd: "Ekle",
      remindersTitle: "Hatırlatıcı",
      reminderPlaceholder: "Neyi hatırlatayım?",
      reminderAdd: "Kur",
      clipboardTitle: "Pano Geçmişi",
      clipboardEmpty: "Henüz bir şey kopyalanmadı (Ctrl+C).",
      clipboardPin: "Sabitle",
      clipboardClear: "Temizle",
      colorPicker: "Renk Seç",
      colorCopied: "Renk kopyalandı",
      dropStar: "Yıldız At",
      starsCaught: "Yıldızlar",
      deviceConnected: "Bağlandı",
      deviceDisconnected: "Ayrıldı",
      audioDevice: "Ses Cihazı",
      usbDevice: "USB Cihazı",
      brightnessLabel: "Parlaklık",
      capsOn: "CAPS LOCK AÇIK",
      capsOff: "CAPS LOCK KAPALI",
      numOn: "NUM LOCK AÇIK",
      numOff: "NUM LOCK KAPALI",
      netDisconnected: "İnternet kesildi",
      netReconnected: "İnternet geri geldi",
      petNameLabel: "Pet Adı",
      petNameSave: "Kaydet",
      bongoTyping: "Yazarken Bongo-Cat Tepkisi",
      fullscreenAutoHide: "Tam Ekranda Otomatik Gizle",
      hourlyChime: "Saat Başı Nazik Zil",
      netSpeedPill: "Adada Canlı İnternet Hızı",
      monitorSelect: "Aktif Monitör",
      waterIntervalLabel: "Su Hatırlatıcı (dk)",
      eyeBreak2020: "20-20-20 Göz Dinlendirme",
      greetingMorning: "Günaydın!",
      greetingAfternoon: "İyi günler!",
      greetingEvening: "İyi akşamlar!",
      greetingNight: "Gece modu aktif, biraz dinlen!",
      tips: [
        "Bir bardak su için ve omuzlarınızı biraz gevşetin.",
        "Adaya çift tıklayarak Mintu'yu masaüstüne çıkarabilirsiniz.",
        "Herhangi bir dosyayı yukarıdaki adaya sürükleyip Dosya Rafında saklayın.",
        "Çalan müzik kapsülüne tıklayıp Now Playing Pro kartını açın.",
        "25 dakikalık Odak Zamanlayıcı ile XP kazanıp yeni aksesuarlar açın.",
      ],
    },
  },
  ru: {
    appName: "Mintu",
    howCanIHelp: "Минту здесь!",
    typeMessageOrSpeak: "Напишите заметку...",
    chips: {
      checkTasks: "Таймер фокуса",
      askAi: "Меню питомца",
      explainCode: "Быстрая заметка",
      tellJoke: "Совет дня",
    },
    drawer: {
      conversations: "Полка файлов",
      searchPlaceholder: "Поиск...",
      newChat: "Новая заметка",
      pin: "Закрепить",
      delete: "Удалить",
      rename: "Переименовать",
    },
    settings: {
      title: "Настройки",
      save: "Сохранить",
      chat: "Главная",
      close: "Закрыть",
      activeModel: "СТИЛЬ",
      downloadModels: "Скины",
      activeModelHint: "Выберите палитру Минту.",
      systemPersonaPrompt: "ПОВЕДЕНИЕ",
      systemPersonaHint: "Настройки поведения питомца.",
      inferenceOptions: "ПАРАМЕТРЫ",
      contextTokens: "Стандарт",
      idleUnload: "Режим сна",
      hardwareAuto: "Авто",
      whenMintuOutside: "КОГДА МИНТУ НА РАБОЧЕМ СТОЛЕ",
      showEmptyPill: "Мини-капсула",
      hideIsland: "Скрыть остров",
      outsideHint: "Вид островка, когда Минту гуляет по экрану.",
      walkWindows: "Гулять по окнам",
      enabled: "Включено",
      disabled: "Отключено",
      walkWindowsHint: "Позволяет Минту ходить по открытым окнам.",
      windowIgnoreList: "Игнорируемые окна",
      windowIgnoreHint: "Имена процессов через запятую.",
      privacyBlocklist: "Список приватности",
      privacyBlocklistHint: "Защищенные окна.",
      systemStartup: "СИСТЕМА И АВТОЗАПУСК",
      autoStart: "Автозапуск с Windows",
      autoStartHint: "Запускать Mintu при старте системы.",
      voiceSpeech: "ЗВУКИ",
      mintuVoice: "Милые звуковые эффекты",
      mintuVoiceHint: "Интерактивные звуки Минту.",
      sttLanguage: "ЯЗЫК",
      sttLanguageHint: "Язык интерфейса.",
      appLanguage: "Язык",
      appLanguageHint: "Основной язык интерфейса Mintu.",
      gamification: "ГАРДЕРОБ",
      wardrobe: "ГАРДЕРОБ МИНТУ",
      wardrobeDesc: "Выберите разблокированный аксессуар.",
      wardrobeItems: {
        none: "Стандартный Минту",
        glasses: "Стильные очки",
        coffee_cup: "Горячий кофе",
        winter_hat: "Зимняя шапка",
        headphones: "Наушники фокуса",
      },
      wardrobeStatus: {
        equipped: "Надето",
        equip: "Надеть",
        unlocksAt: "Откроется на ур. {lvl}",
      },
      xpStatsHint: "Завершено {pomodoros} Помодоро, получено {minutes} минут фокуса.",
      productivityUpdates: "ОБНОВЛЕНИЯ",
      smartClipboard: "Умный буфер",
      smartClipboardHint: "Быстрое форматирование JSON.",
      mintuVersion: "Mintu v0.2.4",
      upToDate: "Актуальная версия.",
      checkUpdates: "Проверить обновления",
      devPanel: "Панель разработчика",
      devPanelHint: "Включает оверлей отладки.",
      diskStorage: "Память",
    },
    actions: {
      clearChat: "Очистить",
      exportMarkdown: "Экспорт",
      newChat: "Новая заметка",
      allChats: "Все",
      settings: "Настройки",
      collapse: "Свернуть (Esc)",
      modelDownloads: "Скины",
    },
    music: {
      notPlaying: "Не играет",
      audioPlayer: "Аудиоплеер",
      paused: "Пауза",
    },
    scratchpad: {
      title: "Быстрая заметка",
      copy: "Копировать",
      copied: "Скопировано",
      summarize: "Очистить",
      summarizing: "Сохранение...",
      clear: "Очистить",
      placeholder: "Напишите заметку... (сохраняется автоматически)",
      characters: "симв.",
      words: "слов",
    },
    petHub: {
      focusTimer: "Таймер фокуса",
      start: "Старт",
      pause: "Пауза",
      resume: "Продолжить",
      reset: "Сброс",
      energy: "Энергия",
      happiness: "Радость",
      feedCookie: "Печенье",
      giveTea: "Мятный чай",
      patMintu: "Погладить (+5)",
      dance: "Танцевать",
      sleep: "Спать",
      chaseCursor: "Ловить курсор",
      stopChase: "Стоп игра",
      desktopMode: "Рабочий стол",
      dailyTip: "Совет",
      quickNote: "Заметка",
      fileShelf: "Полка файлов",
      nowPlaying: "Сейчас играет",
      focusStat: "Фокус",
      xpToday: "XP сегодня",
      streak: "Серия",
      ambientTitle: "Звуки фокуса",
      ambientOff: "Выкл",
      ambientRain: "Дождь",
      ambientFireplace: "Камин",
      ambientBrown: "Глубокий",
      ambientWhite: "Белый",
      shelfTitle: "Полка файлов",
      shelfDropHint: "Перетащите файлы на остров",
      shelfEmpty: "Полка пуста. Перетащите любой файл на верхний остров.",
      shelfOpen: "Открыть",
      shelfReveal: "Папка",
      shelfCopy: "Копировать путь",
      shelfCopied: "Скопировано",
      shelfClear: "Очистить",
      volumeLabel: "Громкость",
      volumeMuted: "Без звука",
      skinsTitle: "Скины Минту",
      moodReactions: "Реакции настроения",
      quietMode: "Тихий режим",
      walkWindows: "Гулять по окнам",
      cuteSounds: "Милые звуки",
      autostart: "Запуск с Windows",
      islandWhenFree: "Остров когда Минту снаружи",
      miniPill: "Мини-капсула",
      hideIsland: "Скрыть остров",
      weatherToggle: "Погода на острове",
      weatherCityPlaceholder: "Город (напр. Baku)",
      weatherSave: "Обновить",
      devPanel: "Панель разработчика",
      cookieFedMsg: "Вкусное печенье! Энергия пополнена (+8 XP)",
      teaGivenMsg: "Теплый мятный чай! Так уютно (+8 XP)",
      chaseStartedMsg: "Готов ловить твой курсор!",
      chaseStoppedMsg: "Хорошо, немного отдохну.",
      weatherConditions: {
        clear: "Ясно",
        cloudy: "Облачно",
        rain: "Дождь",
        snow: "Снег",
        storm: "Гроза",
        fog: "Туман",
      },
      tabPet: "Питомец",
      tabTools: "Инструменты",
      tabSettings: "Настройки",
      waterTitle: "Вода за день",
      waterDrink: "+1 Стакан",
      waterRemTitle: "Вода и отдых для глаз",
      waterRemText: "Выпейте глоток воды и дайте глазам отдохнуть 20 секунд.",
      quickCalcPlaceholder: "Расчет: 450*18, 50 usd to azn, 5 km to m",
      todosTitle: "Задачи на день",
      todoPlaceholder: "Новая задача...",
      todoAdd: "Добавить",
      remindersTitle: "Напоминание",
      reminderPlaceholder: "О чем напомнить?",
      reminderAdd: "Задать",
      clipboardTitle: "История буфера",
      clipboardEmpty: "Пока ничего не скопировано (Ctrl+C).",
      clipboardPin: "Закрепить",
      clipboardClear: "Очистить",
      colorPicker: "Пипетка",
      colorCopied: "Цвет скопирован",
      dropStar: "Звезда",
      starsCaught: "Звезды",
      deviceConnected: "Подключено",
      deviceDisconnected: "Отключено",
      audioDevice: "Аудиоустройство",
      usbDevice: "USB-устройство",
      brightnessLabel: "Яркость",
      capsOn: "CAPS LOCK ВКЛ",
      capsOff: "CAPS LOCK ВЫКЛ",
      numOn: "NUM LOCK ВКЛ",
      numOff: "NUM LOCK ВЫКЛ",
      netDisconnected: "Интернет отключен",
      netReconnected: "Интернет восстановлен",
      petNameLabel: "Имя питомца",
      petNameSave: "Сохранить",
      bongoTyping: "Реакция Bongo-Cat при печати",
      fullscreenAutoHide: "Скрывать в полноэкранном режиме",
      hourlyChime: "Мягкий сигнал каждый час",
      netSpeedPill: "Скорость сети на острове",
      monitorSelect: "Активный монитор",
      waterIntervalLabel: "Напоминание о воде (мин)",
      eyeBreak2020: "Отдых глаз 20-20-20",
      greetingMorning: "Доброе утро!",
      greetingAfternoon: "Добрый день!",
      greetingEvening: "Добрый вечер!",
      greetingNight: "Уютный ночной режим!",
      tips: [
        "Выпейте стакан воды и расслабьте плечи.",
        "Дважды кликните по острову, чтобы выпустить Минту на рабочий стол.",
        "Перетащите файл на верхний остров, чтобы сохранить его на Полке файлов.",
        "Нажмите на музыкальный остров, чтобы открыть карточку Now Playing Pro.",
        "Запустите таймер на 25 минут, чтобы получить XP и открыть аксессуары.",
      ],
    },
  },
};

export class I18nManager {
  private currentLang: SupportedLanguage = "az";

  constructor() {
    const saved =
      typeof localStorage !== "undefined"
        ? (localStorage.getItem("mintu_ui_language") as SupportedLanguage)
        : null;
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
