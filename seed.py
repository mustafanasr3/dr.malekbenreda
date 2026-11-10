# -*- coding: utf-8 -*-
"""البيانات الأولية لمكتبة د. مالك بن رضا المحمدي."""

CHANNEL = "https://www.youtube.com/@m.almohamady"
PLAYLISTS_URL = CHANNEL + "/playlists"
SOCIAL_LINKS = {
    "yt_channel": CHANNEL,
    "yt_playlists": PLAYLISTS_URL,
    "x_url": "https://x.com/MaAlmohamady",
    "telegram_url": "https://t.me/MAlmohamady",
    "telegram_benefits_url": "https://t.me/malkmhmdy",
    "whatsapp_url": "https://chat.whatsapp.com/GblUnrncDRqEghbYpNw7MI",
}

SETTINGS = {
    "site_name": "مالك بن رضا المحمدي",
    "hero_tag": "مكتبة العلوم الشرعية",
    "hero_title": "مالك بن رضا المحمدي",
    "hero_subtitle": "المعهد الرسمي للدكتور",
    "hero_text": "قناة علمية تنشر فيها برامج ودروس وفوائد الشيخ د. مالك المحمدي - وفَّقه الله -",
    "lectures_title": "تصفّح المكتبة بحسب العلم",
    "lectures_sub": "هنا يعرض البرامج و التعليقات والشروح المرتبطة بمعهد الدكتور -وفقه الله-",
    "cta_title": "ابدأ رحلتك العلمية",
    "cta_text": "اختر علمًا، وافتح قائمة التشغيل، وتابع الدروس من مصدرها.",
    "footer_about": "قناة علمية تنشر فيها برامج ودروس وفوائد الشيخ د. مالك المحمدي - وفَّقه الله -",
    "copyright": "© 2026 مالك بن رضا المحمدي · جميع الحقوق محفوظة",
    **SOCIAL_LINKS,
    "terms_text": (
        "باستخدامك هذا الموقع فإنك توافق على الشروط الآتية:\n"
        "١) البيانات التي نجمعها هي الاسم ومعرّف تيليجرام والنوع والمدينة والنبذة الاختيارية، وتُخزّن كلمات المرور بصورة مشفّرة.\n"
        "٢) تُستخدم بيانات الحساب لتشغيل خدمات الموقع وحفظ الدروس التي تختارها.\n"
        "٣) قوائم التشغيل والفيديوهات مضمّنة من قناة يوتيوب، وتبقى حقوقها لأصحابها.\n"
        "٤) يحق لك طلب تعديل بياناتك أو حذف حسابك بالتواصل مع إدارة الموقع.\n"
        "٥) تحتفظ الإدارة بحق إيقاف أي حساب يُساء استخدامه.\n"
        "٦) يُسجّل تقدم الطالب في الدروس وآخر موضع للمشاهدة، ويطّلع عليه المشرفون للمتابعة التعليمية."
    ),
}

CATEGORIES = [
    ("aqidah", "عقيدة", "أصول الإيمان ومسائل الاعتقاد."),
    ("tafsir", "تفسير", "تدبّر معاني الآيات وشرحها."),
    ("sira", "سيرة", "السيرة النبوية وما يتصل بها."),
    ("usul_tafsir", "أصول التفسير", "القواعد والمناهج المعينة على فهم التفسير."),
    ("fiqh", "فقه", "الأحكام الفقهية وشروح المتون."),
    ("usul_fiqh", "أصول الفقه", "قواعد الاستدلال ومناهج النظر الفقهي."),
    ("ulum_quran", "علوم القرآن", "علوم الكتاب وآداب تلاوته."),
    ("qiraat", "القراءات", "التجويد والقراءة وأحكامهما."),
    ("tazkiyah", "تزكية", "ما يرقّق القلب ويهذّب النفس."),
    ("sharia", "شتى علوم الشريعة", "علوم شرعية متنوّعة لا تندرج تحت باب واحد."),
]

# title, playlist ID, category key, thumbnail video ID, sort
VIDEOS = [
    ("برنامج الفقه - السنة الثالثة 1447-1448", "PLHraWnvb3KUQ", "fiqh", "ZAtWP43txmo", 1),
    ("رسالة ابن القيم إلى أحد إخوانه", "PLQnTTS2hra5k", "tazkiyah", "xW16KqXyNyk", 2),
    ("مصطلح الحديث - 1448", "PLY2CPBVV7Stkbuoop-EA8Pq4OOYZTv9hM", "sharia", "CxlAFIlNGjc", 3),
    ("شرح العدة في شرح العمدة", "PLY2CPBVV7Stm3-kn988Tjypwbf1clTlTI", "fiqh", "ToKQ_WqbM_w", 4),
    ("شرح كشف المخدرات", "PLY2CPBVV7StmxTLDCyn2j3rYAFny_RNSJ", "fiqh", "5ozW1KG8_a0", 5),
    ("شرح بلوغ القاصد", "PLY2CPBVV7Stl8oXMIC_OKsiX5rXBClW_f", "fiqh", "F_IglQDbJOE", 6),
    ("شرح آداب المشي إلى الصلاة", "PLY2CPBVV7Stkd0rgdb3EGvTwJc5ANVvRt", "fiqh", "wlWQzPs1KxU", 7),
    ("شرح المقدمة الفقهية الصغرى", "PLY2CPBVV7StmTW2oing3gGgCkRKE2VpbA", "fiqh", "Tgeik8GtAL4", 8),
    ("شرح المفتاح في الفقه", "PLY2CPBVV7Stmba8bfHPuOWq-yn9hmOSol", "fiqh", "UnlDbhxNV7g", 9),
    ("شرح الموضح في التجويد", "PLY2CPBVV7StkmAXEYajXshfVD01840xAd", "qiraat", "ooDRqequBMw", 10),
    ("منحة ذي الجلال والإكرام", "PLY2CPBVV7StkmpKhf4K15aBzhZ06w-nsc", "fiqh", "qrjWAyBE9pk", 11),
    ("مختصر آداب حملة القرآن للنووي", "PLY2CPBVV7StkeJnnJJ0BNnFjplmqT9D6y", "ulum_quran", "sTQOsM7KKRE", 12),
    ("كتاب السنة لعبدالله ابن الإمام أحمد", "PLY2CPBVV7StnB9Eqn4LyFj_U4qIGtL0Zi", "sharia", "e2vCex6zV-4", 13),
    ("عقيدة السلف وأصحاب الحديث للصابوني", "PLY2CPBVV7StlnaZEIfmRVZJ2LyCNLP7uj", "aqidah", "0R7ilwt2Mr0", 14),
    ("فضائل القرآن", "PLY2CPBVV7Stkr9LuH9byVoU4rJiBXqGsY", "ulum_quran", "fegEW1U-gxQ", 15),
    ("حاشية التيسير على منظومة التفسير", "PLY2CPBVV7Stme4oldbcCaldLSyePPWfVP", "usul_tafsir", "L4VKHMKseu0", 16),
    ("إعراب الفاتحة وقصار المفصل", "PLY2CPBVV7Stmb6nnrd20u3hkOPyinsxnX", "tafsir", "mQjhmsJPfSc", 17),
    ("فتح الأقفال شرح تحفة الأطفال", "PLY2CPBVV7StmRKJDpFElxzJ4kPj1piMEK", "qiraat", "PpIk5iojSr4", 18),
    ("منظومة الأبياري", "PLY2CPBVV7StlyHfIHO5qxSAifzEj2Bhme", "usul_fiqh", "dQhKdb5Thlg", 19),
    ("أعلام السنة المنشورة", "PLY2CPBVV7StmUOTNvp2I7k2UhwgjCvbxo", "aqidah", "Pwr08C0zWi8", 20),
    ("مسائل الجاهلية", "PLY2CPBVV7Stk_V0Vq-782bkPKM6J9W4VK", "aqidah", "A2k6Wf6nRxI", 21),
    ("شرح كشف الشبهات", "PLY2CPBVV7StllK4XgMLuFeH4F0l5xcUs5", "aqidah", "oXYy5mKOidA", 22),
    ("شرح فضل الإسلام", "PLY2CPBVV7StloSpLa1ESBvd42Xe7kE6n8", "aqidah", "aQUxLS0MOss", 23),
    ("تجريد التوحيد المفيد", "PLY2CPBVV7Stljri7BKigr539yXHJKxmxy", "aqidah", "krO6WZ5UPOs", 24),
    ("شرح القواعد المثلى", "PLY2CPBVV7StkHu2olnYpVyZ7WEeN2NMrZ", "aqidah", "jCIC2YFK2Cw", 25),
    ("شرح القواعد الأربع", "PLY2CPBVV7StmJkhXsVnz4mnFUVVNO514H", "aqidah", "TR9zeKqX4DE", 26),
    ("شرح ثلاثة الأصول وأدلتها", "PLY2CPBVV7StmIpCJPfw9VXO1bO8m7zOtj", "aqidah", "AMseyDff3co", 27),
    ("شرح العقيدة الواسطية", "PLY2CPBVV7StkN_TUZLpdV5GGnT6m2EsYa", "aqidah", "eyjstE4U9mE", 28),
    ("شرح كتاب التوحيد", "PLY2CPBVV7Stl_ZoqWlJBvj54A4zXfAq-f", "aqidah", "1q5GdnuJyw8", 29),
    ("شرح لمعة الاعتقاد", "PLY2CPBVV7StloZO5ZxTv0pQV-ejGjhMwO", "aqidah", "LwnyBWMkKBw", 30),
]

FAQS = [
    ("كيف أتصفح المكتبة؟", "اختر العلم الذي تريده من التصنيفات، ثم افتح قائمة التشغيل لعرض دروسها."),
    ("كيف أشاهد جميع دروس قائمة التشغيل؟", "اضغط على بطاقة القائمة؛ ستفتح نافذة المشغّل وبداخلها فيديوهات القائمة كاملة."),
    ("من أين يأتي المحتوى؟", "القوائم معروضة من قناة د. مالك بن رضا المحمدي على يوتيوب، وتُشغّل من المصدر مباشرة."),
]
