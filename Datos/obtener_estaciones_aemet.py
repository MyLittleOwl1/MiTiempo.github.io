#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para descargar el listado COMPLETO de estaciones AEMET de toda España
con códigos de estación AEMET

Uso: python3 obtener_estaciones_aemet.py "tu_api_key"

URL CORRECTA: /valores/climatologicos/inventarioestaciones/estaciones/
"""

import requests
import json
import pandas as pd
import csv
from datetime import datetime
import sys

def obtener_estaciones_aemet(api_key):
    """
    Descarga el inventario de estaciones de AEMET usando la API
    
    Args:
        api_key (str): Tu clave API de AEMET OpenData
    
    Returns:
        list: Lista de estaciones con sus datos
    """
    
    # URL CORRECTA del endpoint inventario de estaciones
    url_maestro = "https://opendata.aemet.es/opendata/api/valores/climatologicos/inventarioestaciones/todasestaciones/"
    
    headers = {
        "api_key": api_key
    }
    
    print("📡 Conectando con API de AEMET...")
    print(f"   URL: {url_maestro}")
    
    try:
        # Realizar consulta a AEMET
        response = requests.get(url_maestro, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("estado") == 200:
                # Obtener URL de datos
                url_datos = data.get("datos")
                print(f"✓ Descargando datos de estaciones...")
                print(f"   URL de datos: {url_datos}")
                
                # Descargar los datos reales
                response_datos = requests.get(url_datos, timeout=30)
                
                if response_datos.status_code == 200:
                    estaciones = response_datos.json()
                    print(f"✓ Descargadas {len(estaciones)} estaciones")
                    return estaciones
                else:
                    print(f"❌ Error descargando datos: {response_datos.status_code}")
                    return None
            else:
                print(f"❌ Error: {data.get('descripcion')}")
                print(f"   Respuesta completa: {json.dumps(data, indent=2)}")
                return None
        else:
            print(f"❌ Error de conexión: {response.status_code}")
            print(f"   Respuesta: {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Error de conexión. Verifica tu conexión a internet.")
        return None
    except requests.exceptions.Timeout:
        print("❌ La solicitud tardó demasiado tiempo.")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def procesar_estaciones(estaciones):
    """
    Procesa los datos de estaciones para crear un DataFrame
    
    Args:
        estaciones (list): Lista de estaciones de AEMET
    
    Returns:
        pd.DataFrame: DataFrame con datos procesados
    """
    
    datos_procesados = []
    
    for est in estaciones:
        # Extraer información disponible
        datos_procesados.append({
            "Código_AEMET": est.get("indicativo", ""),
            "Nombre": est.get("nombre", ""),
            "Provincia": est.get("provincia", ""),
            "Municipio": est.get("municipio", ""),
            "Altitud": est.get("altitud", ""),
            "Latitud": est.get("latitud", ""),
            "Longitud": est.get("longitud", ""),
            "Tipo": est.get("tipo", ""),
            "Fecha_Inicio": est.get("fechaInicio", ""),
            "Fecha_Final": est.get("fechaFinal", ""),
        })
    
    return pd.DataFrame(datos_procesados)

def guardar_archivos(df, prefijo="Estaciones_AEMET_Completo"):
    """
    Guarda el DataFrame en diferentes formatos
    
    Args:
        df (pd.DataFrame): DataFrame con los datos
        prefijo (str): Prefijo para los nombres de archivo
    """
    
    print("\n📁 Guardando archivos...")
    
    # Excel
    excel_file = f"{prefijo}.xlsx"
    df.to_excel(excel_file, index=False, sheet_name="Estaciones")
    print(f"✓ Excel: {excel_file}")
    
    # CSV
    csv_file = f"{prefijo}.csv"
    df.to_csv(csv_file, index=False, encoding='utf-8')
    print(f"✓ CSV: {csv_file}")
    
    # TXT
    txt_file = f"{prefijo}.txt"
    with open(txt_file, 'w', encoding='utf-8') as f:
        f.write("=" * 140 + "\n")
        f.write("INVENTARIO DE ESTACIONES METEOROLÓGICAS AEMET - ESPAÑA\n")
        f.write("=" * 140 + "\n")
        f.write(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write(f"Total de estaciones: {len(df)}\n")
        f.write("=" * 140 + "\n\n")
        f.write(df.to_string(index=False))
        f.write(f"\n\n{'=' * 140}\n")
    print(f"✓ TXT: {txt_file}")
    
    # JSON
    json_file = f"{prefijo}.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(df.to_dict(orient='records'), f, indent=2, ensure_ascii=False)
    print(f"✓ JSON: {json_file}")

def main():
    """Función principal"""
    
    print("\n" + "=" * 60)
    print("DESCARGADOR DE ESTACIONES AEMET")
    print("=" * 60)
    
    # Obtener API Key del usuario
    if len(sys.argv) < 2:
        print("\n⚠️  Uso: python3 obtener_estaciones_aemet.py 'tu_api_key'\n")
        print("Ejemplo:")
        print("  python3 obtener_estaciones_aemet.py 'eyJhbGciOiJIUzI1NiJ9...'\n")
        sys.exit(1)
    
    api_key = sys.argv[1]
    
    # Descargar estaciones
    estaciones = obtener_estaciones_aemet(api_key)
    
    if estaciones is None:
        print("\n❌ No se pudieron descargar las estaciones.")
        sys.exit(1)
    
    # Procesar datos
    print("🔄 Procesando datos...")
    df = procesar_estaciones(estaciones)
    
    # Mostrar resumen
    print(f"\n📊 Resumen:")
    print(f"   Total de estaciones: {len(df)}")
    print(f"   Provincias: {df['Provincia'].nunique()}")
    print(f"\n   Provincias presentes:")
    for prov in sorted(df['Provincia'].dropna().unique()):
        cantidad = len(df[df['Provincia'] == prov])
        print(f"      - {prov}: {cantidad} estaciones")
    
    # Guardar archivos
    guardar_archivos(df)
    
    print("\n✓ ¡Proceso completado exitosamente!")
    print("\nℹ️  Nota: Los archivos generados contienen:")
    print("   - Código AEMET: Identificador único de la estación")
    print("   - Nombre, Provincia y Municipio")
    print("   - Coordenadas (latitud/longitud) y altitud")
    print("   - Tipo de estación")
    print("   - Fechas de inicio y final de operación")
    print("\n")

if __name__ == "__main__":
    main()
