#!/usr/bin/env python3
"""Genera el DISEÑO COMPLETO de la tarjeta de lealtad (madera, láser), un SVG por
token, combinando en una sola tarjeta:

  [ LOGO Conejo Negro ]  |  [ QR único CNK-XXXX ]
  ┈┈┈┈┈┈┈ regla 0–7.5 cm con marcas de mm/cm ┈┈┈┈┈┈┈
  (todo dentro de un contorno de corte)

El logo es fijo; lo único que cambia por tarjeta es el QR → grabas cientos sin
rediseñar. Cada QR apunta a {BASE_URL}/loyalty/scan/{TOKEN}.

Capas por color (convención de láser tipo LightBurn):
  * NEGRO (#000000) = GRABAR: logo + QR + regla + números.
  * ROJO  (#ff0000) = CORTAR: contorno de la tarjeta.

⚠️ IMPORTANTE PARA QUE LA REGLA SEA EXACTA:
  El SVG viene dimensionado en milímetros reales (width=85mm height=54mm). Al
  importarlo al software del láser NO lo escales; impórtalo al 100 %. Si lo
  estiras, la regla deja de medir bien.

Fuentes de tokens (elige una):
  1. --tokens CNK-0001,CNK-0002,...
  2. --rango 1-200
  3. (por defecto) la base de datos vía DATABASE_URL

Ejemplos:
  python generar_tarjetas.py --tokens CNK-0001 --base-url https://mi-app.up.railway.app
  python generar_tarjetas.py --rango 1-200 --base-url https://mi-app.up.railway.app

Dependencias:
  pip install "qrcode[pil]" psycopg2-binary   (psycopg2 solo si lees de la DB)
"""

import argparse
import io
import os
import re
import sys

# --- Geometría de la tarjeta (todo en mm; el viewBox del SVG = mm reales) ---
CARD_W, CARD_H = 85.0, 54.0          # tamaño tarjeta (crédito)
CUT_INSET, CUT_RADIUS = 0.3, 3.5      # contorno de corte

LOGO_X, LOGO_Y, LOGO_MAX = 4.0, 5.0, 34.0   # caja del logo (izquierda)
QR_X, QR_Y, QR_SIZE = 50.0, 7.0, 30.0        # QR (derecha), incluye quiet zone

RULER_X0, RULER_LEN = 7.5, 70.0        # regla: empieza en x=7.5mm, mide 70mm (0–7cm exactos)
RULER_BASE_Y = 53.4                    # línea base PEGADA al borde inferior (card=54, corte=53.7)
TICK_MM, TICK_5MM, TICK_CM = 1.2, 2.0, 3.0   # alturas de marca (hacia ARRIBA desde el borde)
RULER_NUM_FS = 1.5                     # tamaño de los números en mm (pequeño, arriba de los ticks)

OUT_DIR_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tarjetas")
LOGO_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "logos", "Conejo negro logo NEGATIVO.svg")


# ----------------------------- tokens -----------------------------
def tokens_desde_rango(rango: str):
    try:
        inicio, fin = map(int, rango.split("-"))
    except ValueError:
        sys.exit("Formato de --rango inválido. Usa por ejemplo: --rango 1-200")
    if inicio < 1 or fin < inicio:
        sys.exit("Rango inválido: inicio >= 1 y fin >= inicio.")
    return [f"CNK-{n:04d}" for n in range(inicio, fin + 1)]


def tokens_desde_db():
    try:
        import psycopg2
    except ImportError:
        sys.exit('Falta psycopg2. Instala:  pip install psycopg2-binary')
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("No hay DATABASE_URL. Usa --rango / --tokens, o expórtala.")
    conn = psycopg2.connect(url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT token FROM clientes ORDER BY token ASC")
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


# ----------------------------- logo -----------------------------
def cargar_logo_paths(logo_path):
    """Extrae los <path> OSCUROS del logo (descarta el fondo blanco #ffffff) y
    devuelve (lista_de_d, ancho_viewbox, alto_viewbox). Sin transforms (verificado)."""
    with open(logo_path, "r", encoding="utf-8") as f:
        svg = f.read()

    vb = re.search(r'viewBox="([\d.\s]+)"', svg)
    if not vb:
        sys.exit(f"El logo {logo_path} no tiene viewBox; no puedo escalarlo.")
    _, _, vw, vh = (float(x) for x in vb.group(1).split())

    paths = []
    for m in re.finditer(r'<path\b([^>]*)/?>', svg, re.IGNORECASE):
        attrs = m.group(1)
        fill = re.search(r'fill="([^"]*)"', attrs, re.IGNORECASE)
        d = re.search(r'\bd="([^"]*)"', attrs, re.IGNORECASE)
        if not d:
            continue
        color = (fill.group(1).lower() if fill else "#000000")
        if color in ("#ffffff", "#fff", "white"):
            continue  # fondo blanco -> no grabar
        paths.append(d.group(1))
    if not paths:
        sys.exit("No encontré paths oscuros en el logo (¿todo es blanco?).")
    return paths, vw, vh


def bloque_logo(paths, vw, vh):
    """Escala el logo (manteniendo proporción) dentro de la caja y lo centra."""
    s = min(LOGO_MAX / vw, LOGO_MAX / vh)
    draw_w, draw_h = vw * s, vh * s
    tx = LOGO_X + (LOGO_MAX - draw_w) / 2
    ty = LOGO_Y + (LOGO_MAX - draw_h) / 2
    inner = "".join(f'<path d="{d}" fill="#000000"/>' for d in paths)
    return f'<g transform="translate({tx:.3f},{ty:.3f}) scale({s:.6f})">{inner}</g>'


# ----------------------------- QR -----------------------------
def bloque_qr(url, ec_name):
    import qrcode
    from qrcode.image.svg import SvgPathImage
    ec = {"L": qrcode.constants.ERROR_CORRECT_L, "M": qrcode.constants.ERROR_CORRECT_M,
          "Q": qrcode.constants.ERROR_CORRECT_Q, "H": qrcode.constants.ERROR_CORRECT_H}[ec_name]
    qr = qrcode.QRCode(error_correction=ec, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(image_factory=SvgPathImage)
    buf = io.BytesIO(); img.save(buf)
    svg = buf.getvalue().decode("utf-8")

    side = float(re.search(r'viewBox="0 0 ([\d.]+)', svg).group(1))  # lado en unidades del QR
    d = re.search(r'<path[^>]*\bd="([^"]*)"', svg).group(1)
    s = QR_SIZE / side
    return (f'<g transform="translate({QR_X:.3f},{QR_Y:.3f}) scale({s:.6f})">'
            f'<path d="{d}" fill="#000000"/></g>')


# ----------------------------- regla -----------------------------
def bloque_regla():
    """Regla de canto: línea base PEGADA al borde inferior, marcas de 1/5/10 mm
    hacia ARRIBA, y números por cm ENCIMA de los ticks (pequeños, sin encimarse)."""
    partes = ['<g fill="none" stroke="#000000" stroke-width="0.18">']
    # línea base (al borde inferior)
    partes.append(f'<line x1="{RULER_X0:.3f}" y1="{RULER_BASE_Y:.3f}" '
                  f'x2="{RULER_X0 + RULER_LEN:.3f}" y2="{RULER_BASE_Y:.3f}"/>')
    for mm in range(0, int(RULER_LEN) + 1):
        x = RULER_X0 + mm
        h = TICK_CM if mm % 10 == 0 else (TICK_5MM if mm % 5 == 0 else TICK_MM)
        partes.append(f'<line x1="{x:.3f}" y1="{RULER_BASE_Y:.3f}" '
                      f'x2="{x:.3f}" y2="{RULER_BASE_Y - h:.3f}"/>')
    partes.append('</g>')
    # números por cm, ARRIBA del tick de cm (baseline 0.6 mm por encima del tick),
    # letra pequeña para no encimarse con las marcas.
    num_y = RULER_BASE_Y - TICK_CM - 0.6
    partes.append(f'<g fill="#000000" font-family="Arial, sans-serif" '
                  f'font-size="{RULER_NUM_FS}" text-anchor="middle">')
    for cm in range(0, int(RULER_LEN // 10) + 1):
        x = RULER_X0 + cm * 10
        partes.append(f'<text x="{x:.3f}" y="{num_y:.3f}">{cm}</text>')
    partes.append(f'<text x="{RULER_X0 + RULER_LEN + 1.6:.3f}" y="{num_y:.3f}" '
                  f'text-anchor="start" font-size="{RULER_NUM_FS * 0.85:.2f}">cm</text>')
    partes.append('</g>')
    return "".join(partes)


# ----------------------------- tarjeta -----------------------------
def componer_tarjeta(logo_g, qr_g, ruler_g):
    cut = (f'<rect x="{CUT_INSET:.3f}" y="{CUT_INSET:.3f}" '
           f'width="{CARD_W - 2 * CUT_INSET:.3f}" height="{CARD_H - 2 * CUT_INSET:.3f}" '
           f'rx="{CUT_RADIUS:.3f}" fill="none" stroke="#ff0000" stroke-width="0.2"/>')
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
        f'width="{CARD_W}mm" height="{CARD_H}mm" '
        f'viewBox="0 0 {CARD_W} {CARD_H}">\n'
        f'  <!-- CORTE (rojo) -->\n  {cut}\n'
        f'  <!-- GRABADO (negro): logo + QR + regla -->\n'
        f'  {logo_g}\n  {qr_g}\n  {ruler_g}\n'
        f'</svg>\n'
    )


def main():
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

    p = argparse.ArgumentParser(description="Genera tarjetas de lealtad (logo+QR+regla) en SVG para láser.")
    p.add_argument("--base-url", default=os.environ.get("LOYALTY_BASE_URL"),
                   help="URL base del POS (o var LOYALTY_BASE_URL).")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--rango", help="Ej: 1-200 -> CNK-0001..CNK-0200")
    g.add_argument("--tokens", help="Ej: CNK-0001,CNK-0002")
    p.add_argument("--logo", default=LOGO_DEFAULT, help="SVG del logo.")
    p.add_argument("--ec", choices=["L", "M", "Q", "H"], default="M",
                   help="Corrección de error del QR (H = más tolerante en madera).")
    p.add_argument("--out", default=OUT_DIR_DEFAULT, help="Carpeta de salida (por defecto ./tarjetas)")
    args = p.parse_args()

    if not args.base_url:
        sys.exit("Falta --base-url (o la variable LOYALTY_BASE_URL).")
    base_url = args.base_url.rstrip("/")

    try:
        import qrcode  # noqa: F401
    except ImportError:
        sys.exit('Falta qrcode. Instala:  pip install "qrcode[pil]"')

    if not os.path.exists(args.logo):
        sys.exit(f"No encuentro el logo: {args.logo}")

    if args.tokens:
        tokens = [t.strip().upper() for t in args.tokens.split(",") if t.strip()]
    elif args.rango:
        tokens = tokens_desde_rango(args.rango)
    else:
        print("Leyendo tokens desde la base de datos (DATABASE_URL)…")
        tokens = tokens_desde_db()
    if not tokens:
        sys.exit("No hay tokens para generar.")

    logo_paths, vw, vh = cargar_logo_paths(args.logo)
    logo_g = bloque_logo(logo_paths, vw, vh)   # el logo es igual en todas
    ruler_g = bloque_regla()                    # la regla también

    os.makedirs(args.out, exist_ok=True)
    for token in tokens:
        url = f"{base_url}/loyalty/scan/{token}"
        svg = componer_tarjeta(logo_g, bloque_qr(url, args.ec), ruler_g)
        with open(os.path.join(args.out, f"{token}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"  ✓ {token} -> {url}")

    print(f"\nListo: {len(tokens)} tarjeta(s) SVG ({CARD_W:.0f}×{CARD_H:.0f} mm) en {args.out}")
    print("Recuerda: importa al láser al 100 % (sin escalar) para que la regla mida bien.")


if __name__ == "__main__":
    main()
