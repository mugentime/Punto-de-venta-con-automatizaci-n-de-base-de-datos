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

Esta "app de escritorio" es también el ÚNICO lugar para dar de alta o borrar
tarjetas: habla con el POS por HTTP para que el punto de venta reconozca los QR
(activar / sumar puntos). El panel del cajero (/loyalty) queda solo de consulta.

Modos (elige uno):
  --crear N            Da de alta N tokens NUEVOS en el POS y genera sus tarjetas.
  --rango 1-200        Regenera SVGs de tokens que YA existen (no crea).
  --tokens CNK-0001,…  Regenera SVGs de esos tokens (no crea).
  --eliminar CNK-0001,…  Borra tarjetas del POS (no genera SVG).
  (sin nada)           Regenera SVGs de TODAS las tarjetas dadas de alta en el POS.

Ejemplos:
  # dar de alta 200 y producir sus tarjetas para el láser (un solo paso):
  python generar_tarjetas.py --crear 200 --base-url https://mi-app.up.railway.app
  # regenerar todas las tarjetas existentes:
  python generar_tarjetas.py --base-url https://mi-app.up.railway.app
  # borrar de prueba:
  python generar_tarjetas.py --eliminar CNK-0001,CNK-0002 --base-url https://mi-app.up.railway.app

Dependencias:
  pip install "qrcode[pil]"     (la comunicación con el POS usa solo la stdlib)
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

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


# ----------------------------- API del POS -----------------------------
# El script "app de escritorio" habla con el POS por HTTP (stdlib, sin psycopg2):
#   * dar de alta tokens   -> POST /loyalty/generar
#   * borrar tokens        -> DELETE /loyalty/cliente/:token
#   * listar existentes    -> GET  /loyalty/clientes
# Así el POS reconoce los QR para activar / sumar puntos al escanear.
def api(base_url, method, path, body=None):
    url = base_url + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            txt = r.read().decode("utf-8")
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(txt)
        except ValueError:
            payload = {"error": txt[:200]}
        return e.code, payload
    except urllib.error.URLError as e:
        sys.exit(f"No pude conectar con el POS ({url}): {e.reason}")


def crear_tokens_en_pos(base_url, cantidad):
    """POST /loyalty/generar -> da de alta N tokens en el POS y devuelve la lista."""
    status, data = api(base_url, "POST", "/loyalty/generar", {"cantidad": cantidad})
    if status != 201 or not isinstance(data, dict) or "tokens" not in data:
        sys.exit(f"El POS rechazó la creación ({status}): {data}")
    return data["tokens"]


def tokens_desde_api(base_url):
    """GET /loyalty/clientes -> todos los tokens ya dados de alta en el POS."""
    status, data = api(base_url, "GET", "/loyalty/clientes")
    if status != 200 or not isinstance(data, list):
        sys.exit(f"No pude leer los clientes del POS ({status}): {data}")
    return [c["token"] for c in data]


def eliminar_tokens_en_pos(base_url, tokens):
    """DELETE /loyalty/cliente/:token por cada token."""
    ok = 0
    for t in tokens:
        status, data = api(base_url, "DELETE", f"/loyalty/cliente/{t}")
        marca = "✓" if status == 200 else "✗"
        print(f"  {marca} {t} -> {status} {data}")
        ok += 1 if status == 200 else 0
    print(f"\nEliminadas {ok}/{len(tokens)} tarjeta(s) del POS.")


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

    p = argparse.ArgumentParser(
        description="App de escritorio: da de alta tarjetas en el POS y genera su "
                    "diseño (logo+QR+regla) en SVG para láser.")
    p.add_argument("--base-url", default=os.environ.get("LOYALTY_BASE_URL"),
                   help="URL base del POS (o var LOYALTY_BASE_URL).")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--crear", type=int, metavar="N",
                   help="Da de alta N tokens NUEVOS en el POS y genera sus tarjetas.")
    g.add_argument("--rango", help="Regenera SVGs de un rango existente. Ej: 1-200")
    g.add_argument("--tokens", help="Regenera SVGs de estos tokens. Ej: CNK-0001,CNK-0002")
    g.add_argument("--eliminar", metavar="TOKENS",
                   help="Borra tarjetas del POS (no genera SVG). Ej: CNK-0001,CNK-0002")
    p.add_argument("--logo", default=LOGO_DEFAULT, help="SVG del logo.")
    p.add_argument("--ec", choices=["L", "M", "Q", "H"], default="M",
                   help="Corrección de error del QR (H = más tolerante en madera).")
    p.add_argument("--out", default=OUT_DIR_DEFAULT, help="Carpeta de salida (por defecto ./tarjetas)")
    args = p.parse_args()

    if not args.base_url:
        sys.exit("Falta --base-url (o la variable LOYALTY_BASE_URL).")
    base_url = args.base_url.rstrip("/")

    # --- Modo borrar: solo habla con el POS, no genera SVG ---
    if args.eliminar:
        toks = [t.strip().upper() for t in args.eliminar.split(",") if t.strip()]
        if not toks:
            sys.exit("--eliminar no recibió tokens válidos.")
        eliminar_tokens_en_pos(base_url, toks)
        return

    try:
        import qrcode  # noqa: F401
    except ImportError:
        sys.exit('Falta qrcode. Instala:  pip install "qrcode[pil]"')

    if not os.path.exists(args.logo):
        sys.exit(f"No encuentro el logo: {args.logo}")

    # --- Determinar los tokens a producir ---
    if args.crear is not None:
        if args.crear < 1:
            sys.exit("--crear debe ser un entero >= 1.")
        print(f"Dando de alta {args.crear} tarjeta(s) nueva(s) en el POS…")
        tokens = crear_tokens_en_pos(base_url, args.crear)
        print(f"  → altas: {tokens[0]} .. {tokens[-1]}")
    elif args.tokens:
        tokens = [t.strip().upper() for t in args.tokens.split(",") if t.strip()]
    elif args.rango:
        tokens = tokens_desde_rango(args.rango)
    else:
        print("Sin --crear/--rango/--tokens: leyendo TODAS las tarjetas del POS…")
        tokens = tokens_desde_api(base_url)
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
