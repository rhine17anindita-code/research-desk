"""Bangla → English on this Mac, free and offline (Meta's NLLB-200 600M, compact int8 version).
Reads JSON {"parts": [...]} on stdin, prints JSON {"parts": [...]} in the same order."""
import json, os, re, sys, unicodedata
import ctranslate2
from transformers import AutoTokenizer

MODEL = os.environ.get("NLLB_MODEL", os.path.expanduser("~/.research-desk-models/nllb-600m-int8"))
tok = AutoTokenizer.from_pretrained(MODEL, src_lang="ben_Beng")
tr = ctranslate2.Translator(MODEL, device="cpu", compute_type="int8", inter_threads=1, intra_threads=4)
BN = re.compile(r"[ঀ-৿]")

# Names and terms the model doesn't know: swapped for their English spelling before translating.
GLOSSARY = {
    "ওয়াকার-উজ-জামান": "Waker-uz-Zaman", "ওয়াকারুজ্জামান": "Waker-uz-Zaman", "ওয়াকার": "Waker",
    "তারেক রহমান": "Tarique Rahman", "তারেক": "Tarique", "ইউনূস": "Yunus", "ইউনুস": "Yunus", "হাসিনা": "Hasina",
    "শেখ মুজিব": "Sheikh Mujib", "খালেদা জিয়া": "Khaleda Zia", "জিয়াউর রহমান": "Ziaur Rahman", "মির্জা ফখরুল": "Mirza Fakhrul",
    "বিএনপি": "BNP", "জামায়াতে ইসলামী": "Jamaat-e-Islami", "জামায়াত": "Jamaat", "আওয়ামী লীগ": "Awami League", "এনসিপি": "NCP",
    "বিজিবি": "BGB", "বিএসএফ": "BSF", "সীমান্তরক্ষী বাহিনী": "border force", "সেনাবাহিনী": "army", "পুলিশ": "police",
    "শিবির": "Shibir", "ছাত্রলীগ": "Chhatra League", "ছাত্রদল": "Chhatra Dal", "র‍্যাব": "RAB", "ডিজিএফআই": "DGFI",
    "নাহিদ ইসলাম": "Nahid Islam", "আসিফ নজরুল": "Asif Nazrul", "পিনাকী": "Pinaki", "ইলিয়াস": "Elias",
    "ঢাকা": "Dhaka", "চট্টগ্রাম": "Chattogram", "সিলেট": "Sylhet", "রোহিঙ্গা": "Rohingya", "তিস্তা": "Teesta",
}

# Slang and idioms the model misreads: swapped for plain Bangla first (the model then translates them well).
IDIOMS = {"দুধভাত": "গুরুত্বহীন", "ইন্ডিয়া": "ভারত", "পাকিস্থান": "পাকিস্তান", "আম্রিকা": "আমেরিকা"}
# Bangla letters like য় can be stored two ways; normalise names and text the same way so they match.
_GLOSS = sorted(((unicodedata.normalize("NFC", k), v) for k, v in GLOSSARY.items()), key=lambda kv: -len(kv[0]))
_IDIOMS = [(unicodedata.normalize("NFC", k), unicodedata.normalize("NFC", v)) for k, v in IDIOMS.items()]


def protect(text):
    text = unicodedata.normalize("NFC", text)
    for bn, plain in _IDIOMS:
        text = text.replace(bn, plain)
    for bn, en in _GLOSS:
        # Names go in English but keep their Bangla endings, written the way Bangla writers do: "Waker-এর".
        text = re.sub(re.escape(bn) + r"(ের|এর|র|কে|দের)", lambda m: f"{en}-{'এর' if m.group(1) in ('ের', 'এর', 'র') else m.group(1)}", text)
        text = text.replace(bn, en)
    return re.sub(r"\s+", " ", text).strip()


def pieces(text):
    # One sentence at a time (long inputs make the model skip sentences); very long ones split at commas.
    out = []
    for sent in re.split(r"(?<=[।?!.])\s+|\n+", text.strip()):
        sent = sent.strip()
        if not sent:
            continue
        while len(sent) > 260:
            cut = sent.rfind(",", 0, 260)
            cut = cut if cut > 80 else 260
            out.append(sent[:cut + 1].strip()); sent = sent[cut + 1:].strip()
        if sent:
            out.append(sent)
    return out or [text]


def translate(texts):
    # Titles like "বাংলা কথা || Show name || Series": translate only the Bangla segments, keep the rest.
    segs = [re.split(r"(\s*\|\|?\s*|\s+[-–—]\s+)", t or "") for t in texts]
    flat, owner = [], []
    for i, parts in enumerate(segs):
        for j, seg in enumerate(parts):
            if j % 2 == 0 and BN.search(seg):
                for p in pieces(seg):
                    flat.append(protect(p)); owner.append((i, j))
    if not flat:
        return list(texts)
    toks = [tok.convert_ids_to_tokens(tok.encode(p)) for p in flat]
    res = tr.translate_batch(toks, target_prefix=[["eng_Latn"]] * len(toks), beam_size=4, max_batch_size=24, max_decoding_length=300, repetition_penalty=1.1)
    done = {}
    for key, r in zip(owner, res):
        done.setdefault(key, []).append(tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0][1:]), skip_special_tokens=True))
    out = []
    for i, parts in enumerate(segs):
        out.append("".join(" ".join(done[(i, j)]) if (i, j) in done else seg for j, seg in enumerate(parts)).strip())
    return out


data = json.load(sys.stdin)
print(json.dumps({"parts": translate(data["parts"])}, ensure_ascii=False))
