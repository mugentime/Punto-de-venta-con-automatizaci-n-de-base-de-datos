#!/usr/bin/env python3
"""Genera un archivo de código QR por cada tarjeta de lealtad del Conejo Negro.

Cada QR apunta a:  {BASE_URL}/loyalty/scan/{TOKEN}
de modo que, al escanearlo con el celular, se registra la visita del día.

Formato de salida:
  --format svg  (por defecto)  -> vectorial, un solo <path>. IDEAL PARA LÁSER:
                                  bordes perfectos y escala a cualquier tamaño.
                                  El tamaño físico se fija con --size-mm.
  --format png                 -> raster de alta resolución (para impresión /
                                  stickers, o láser que solo hace grabado raster).

Fuentes de tokens (elige una):
  1. --tokens CNK-0001,CNK-0002,...   -> lista explícita
  2. --rango 1-200                    -> genera CNK-0001 .. CNK-0200
  3. (por defecto) la base de datos   -> lee la tabla `clientes` vía DATABASE_URL

Ejemplos:
  python generar_qrs.py --rango 1-200 --base-url https://mi-app.up.railway.app
  python generar_qrs.py --rango 1-200 --size-mm 25 --base-url https://mi-app.up.railway.app
  python generar_qrs.py --format png --box-size 20 --tokens CNK-0001 --base-url https://mi-app.up.railway.app

La URL base también puede venir de la variable de entorno LOYALTY_BASE_URL.

Notas para el láser:
  * El SVG ya incluye el margen blanco (quiet zone) que el QR necesita para
    escanear: NO lo recortes al montarlo en el diseño de la tarjeta.
  * Para grabado en madera, un QR de >= 25-30 mm de lado escanea con holgura.
  * --ec H hace el QR más tolerante a suciedad/grano (pero más denso).

Dependencias:
  pip install "qrcode[pil]" psycopg2-binary
  (para --format svg NO hace falta pillow; para png sí)
"""

import argparse
import os
import re
import sys

OUT_DIR_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qrs")


def tokens_desde_rango(rango: str):
    """'1-200' -> ['CNK-0001', ..., 'CNK-0200']."""
    try:
        inicio, fin = rango.split("-")
        inicio, fin = int(inicio), int(fin)
    except ValueError:
        sys.exit("Formato de --rango inválido. Usa por ejemplo: --rango 1-200")
    if inicio < 1 or fin < inicio:
        sys.exit("Rango inválido: el inicio debe ser >= 1 y el fin >= inicio.")
    return [f"CNK-{n:04d}" for n in range(inicio, fin + 1)]


def tokens_desde_db():
    """Lee todos los tokens de la tabla `clientes` usando DATABASE_URL."""
    try:
        import psycopg2
    except ImportError:
        sys.exit('Falta psycopg2. Instala:  pip install psycopg2-binary')

    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(
            "No hay DATABASE_URL en el entorno.\n"
            "Opciones: exporta DATABASE_URL, o usa --rango / --tokens."
        )

    conn = psycopg2.connect(url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT token FROM clientes ORDER BY token ASC")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def _ec_const(name):
    import qrcode
    return {
        "L": qrcode.constants.ERROR_CORRECT_L,
        "M": qrcode.constants.ERROR_CORRECT_M,
        "Q": qrcode.constants.ERROR_CORRECT_Q,
        "H": qrcode.constants.ERROR_CORRECT_H,
    }[name]


def _build_qr(url, ec_name, box_size):
    import qrcode
    qr = qrcode.QRCode(
        error_correction=_ec_const(ec_name),
        box_size=box_size,
        border=4,  # quiet zone estándar; necesaria para escanear
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr


def guardar_svg(qr, destino, size_mm):
    """SVG vectorial (un <path>) con el tamaño físico fijado en mm."""
    from qrcode.image.svg import SvgPathImage
    import io
    img = qr.make_image(image_factory=SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")
    # Fijar el tamaño físico total (incluye la quiet zone) al valor pedido en mm,
    # conservando el viewBox para que escale limpio en el software del láser.
    svg = re.sub(r'width="[^"]*"', f'width="{size_mm}mm"', svg, count=1)
    svg = re.sub(r'height="[^"]*"', f'height="{size_mm}mm"', svg, count=1)
    with open(destino, "w", encoding="utf-8") as f:
        f.write(svg)


def guardar_png(qr, destino):
    """PNG raster de alta resolución (según --box-size)."""
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(destino)


def main():
    # La consola de Windows usa cp1252 por defecto y truena al imprimir ✓ o acentos.
    # Forzar UTF-8 en stdout/stderr evita ese UnicodeEncodeError.
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        description="Genera QRs de tarjetas de lealtad para el POS Conejo Negro.")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("LOYALTY_BASE_URL"),
        help="URL base del POS, ej: https://mi-app.up.railway.app "
             "(o variable de entorno LOYALTY_BASE_URL).")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--rango", help="Rango numérico, ej: 1-200 -> CNK-0001..CNK-0200")
    grupo.add_argument("--tokens", help="Lista separada por comas, ej: CNK-0001,CNK-0002")
    parser.add_argument("--format", choices=["svg", "png"], default="svg",
                        help="Formato de salida (por defecto svg, vectorial para láser).")
    parser.add_argument("--size-mm", type=float, default=30.0,
                        help="[svg] Tamaño físico del QR en mm, incluye margen (por defecto 30).")
    parser.add_argument("--box-size", type=int, default=20,
                        help="[png] Píxeles por módulo (por defecto 20 = alta resolución).")
    parser.add_argument("--ec", choices=["L", "M", "Q", "H"], default="M",
                        help="Nivel de corrección de error (por defecto M; H = más tolerante).")
    parser.add_argument("--out", default=OUT_DIR_DEFAULT,
                        help="Carpeta de salida (por defecto ./qrs)")
    args = parser.parse_args()

    if not args.base_url:
        sys.exit("Falta --base-url (o la variable de entorno LOYALTY_BASE_URL).")
    base_url = args.base_url.rstrip("/")

    try:
        import qrcode  # noqa: F401  (validación temprana de dependencia)
    except ImportError:
        sys.exit('Falta qrcode. Instala:  pip install "qrcode[pil]"')

    # Selección de la fuente de tokens.
    if args.tokens:
        tokens = [t.strip().upper() for t in args.tokens.split(",") if t.strip()]
    elif args.rango:
        tokens = tokens_desde_rango(args.rango)
    else:
        print("Leyendo tokens desde la base de datos (DATABASE_URL)…")
        tokens = tokens_desde_db()

    if not tokens:
        sys.exit("No hay tokens para generar.")

    os.makedirs(args.out, exist_ok=True)

    generados = 0
    for token in tokens:
        url = f"{base_url}/loyalty/scan/{token}"
        # box_size solo importa para PNG; para SVG el tamaño real lo fija --size-mm.
        qr = _build_qr(url, args.ec, args.box_size)
        destino = os.path.join(args.out, f"{token}.{args.format}")
        if args.format == "svg":
            guardar_svg(qr, destino, args.size_mm)
        else:
            guardar_png(qr, destino)
        generados += 1
        print(f"  ✓ {token} -> {url}")

    tam = f"{args.size_mm} mm" if args.format == "svg" else f"box-size {args.box_size}"
    print(f"\nListo: {generados} QR(s) {args.format.upper()} ({tam}, EC={args.ec}) en {args.out}")


if __name__ == "__main__":
    main()
