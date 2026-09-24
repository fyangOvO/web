# -*- coding: utf-8 -*-
path = r"D:\YFY\personal-site\personal-site\web\src\composables\useI18n.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = "    'companion.settings': 'Settings',\n\n    // === Errors ==="
new = """    'companion.settings': 'Settings',
    'companion.wakeMsg': 'Mmm~ just woke up from a nap',
    'companion.loveMsg': 'Love you~',
    'companion.returnMsg': "I'm back!",
    'companion.alt': 'Site companion',
    'companion.greet': 'Say hi',
    'companion.rest': 'Let her rest',
    'companion.collapseTitle': 'Collapse',
    'companion.expandTitle': 'Expand',
    'companion.expandBtn': 'Expand companion',
    'companion.bubble.idle1': 'Have a great day~',
    'companion.bubble.idle2': 'Headpats',
    'companion.bubble.idle3': 'Need help?',
    'companion.bubble.idle4': 'I am here with you',
    'companion.bubble.idle5': 'Click me to chat',
    'companion.bubble.idle6': 'How is the weather today?',
    'companion.bubble.idle7': 'Remember to drink water',
    'companion.bubble.idle8': 'Take it easy~',
    'companion.bubble.happy1': 'Awesome!',
    'companion.bubble.happy2': 'Yay~ happy!',
    'companion.bubble.happy3': 'So happy for you',
    'companion.bubble.happy4': 'Keep it up!',
    'companion.bubble.think1': 'Hmm... let me think',
    'companion.bubble.think2': 'This is a tough one',
    'companion.bubble.think3': 'Maybe try another way?',
    'companion.bubble.wave1': 'Hi~ hello!',
    'companion.bubble.wave2': 'Welcome to my site',
    'companion.bubble.wave3': 'Stay energetic today!',
    'companion.bubble.sleep1': 'Zzz...',
    'companion.bubble.sleep2': 'So sleepy...',
    'companion.bubble.sleep3': 'Let me rest a bit...',

    // === Errors ==="""
content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("en companion done")
