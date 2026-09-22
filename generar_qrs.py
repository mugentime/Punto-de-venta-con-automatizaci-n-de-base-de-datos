#!/usr/bin/env python3
"""Genera un PNG de código QR por cada tarjeta de lealtad del Conejo Negro.

Cada QR apunta a:  {BASE_URL}/loyalty/scan/{TOKEN}
de modo que, al escanearlo con el celular, se registra la visita del día.

Fuentes de tokens (elige una):
  1. --tokens CNK-0001,CNK-0002,...   -> lista explícita
  2. --rango 1-200                    -> genera CNK-0001 .. CNK-0200
  3. (por defecto) la base de datos   -> lee la tabla `clientes` vía DATABASE_URL

Ejemplos:
  python generar_qrs.py --base-url https://mi-app.up.railway.app
  python generar_qrs.py --rango 1-200 --base-url https://mi-app.up.railway.app
  python generar_qrs.py --tokens CNK-0001,CNK-0002 --base-url https://mi-app.up.railway.app

La URL base también puede venir de la variable de entorno LOYALTY_BASE_URL.

Dependencias:
  pip install "qrcode[pil]" psycopg2-binary
"""

import argparse
import os
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


def main():
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
    parser.add_argument("--out", default=OUT_DIR_DEFAULT,
                        help="Carpeta de salida (por defecto ./qrs)")
    args = parser.parse_args()

    if not args.base_url:
        sys.exit("Falta --base-url (o la variable de entorno LOYALTY_BASE_URL).")
    base_url = args.base_url.rstrip("/")

    try:
        import qrcode
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
        img = qrcode.make(url)
        destino = os.path.join(args.out, f"{token}.png")
        img.save(destino)
        generados += 1
        print(f"  ✓ {token} -> {url}")

    print(f"\nListo: {generados} QR(s) generados en {args.out}")


if __name__ == "__main__":
    main()
