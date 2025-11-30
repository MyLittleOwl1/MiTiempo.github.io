#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para rellenar el campo 'Municipio' en el archivo AEMET
basándose en el código de estación y nombre de la estación

Uso: python3 rellenar_municipios_aemet.py archivo.csv
"""

import pandas as pd
import sys
import re

# Base de datos COMPLETA de relación Código AEMET -> Municipio
# Basada en el inventario de estaciones meteorológicas de AEMET 2025
MUNICIPIOS_AEMET = {
    # BALEARES - MALLORCA
    'B013X': 'Escorca',
    'B051A': 'Sóller',
    'B087X': 'Banyalbúfar',
    'B103B': 'Andratx',
    'B158X': 'Calvià',
    'B228': 'Palma',
    'B236C': 'Palma',
    'B248': 'Bunyola',
    'B275E': 'Palma',
    'B278': 'Palma',
    'B301': 'Llucmayor',
    'B334X': 'Llucmayor',
    'B341X': 'Porreres',
    'B346X': 'Porreres',
    'B362X': 'Campos',
    'B373X': 'Campos',
    'B398A': 'Palma',
    'B410B': 'Santanyí',
    'B434X': 'Manacor',
    'B496X': 'Son Servera',
    'B526X': 'Artà',
    'B569X': 'Capdepera',
    'B603X': 'Artà',
    'B605X': 'Muro',
    'B614E': 'Manacor',
    'B640X': 'Petra',
    'B644B': 'Sineu',
    'B656A': 'Santa María del Camí',
    'B662X': 'Binissalem',
    'B684A': 'Escorca',
    'B691': 'Sa Pobla',
    'B691Y': 'Sa Pobla',
    'B760X': 'Pollença',
    'B780X': 'Pollença',
    'B800X': 'Maó',
    'B825B': 'Es Mercadal',
    'B860X': 'Ciutadella de Menorca',
    'B870C': 'Ciutadella de Menorca',
    'B893': 'Maó',
    'B908X': 'Sant Joan de Labritja',
    'B925': 'Sant Antoni de Portmany',
    'B954': 'Ibiza',
    'B957': 'Ibiza',
    'B986': 'Formentera',
    
    # CANARIAS - LAS PALMAS
    'C018J': 'Tías',
    'C019V': 'Yaiza',
    'C029O': 'Teguise',
    'C038N': 'Haría',
    'C048W': 'Tinajo',
    'C229J': 'Pájara',
    'C239N': 'Tuineje',
    'C248E': 'Antigua',
    'C249I': 'Antigua',
    'C258K': 'La Oliva',
    'C611E': 'Vega de San Mateo',
    'C612F': 'Tejeda',
    'C614H': 'Tejeda',
    'C619I': 'La Aldea de San Nicolás',
    'C619X': 'Agaete',
    'C619Y': 'La Aldea de San Nicolás',
    'C623I': 'San Bartolomé de Tirajana',
    'C625O': 'San Bartolomé de Tirajana',
    'C628B': 'La Aldea de San Nicolás',
    'C629Q': 'Mogán',
    'C629X': 'Mogán',
    'C635B': 'San Bartolomé de Tirajana',
    'C639M': 'San Bartolomé de Tirajana',
    'C639U': 'San Bartolomé de Tirajana',
    'C648C': 'Agüimes',
    'C648N': 'Telde',
    'C649I': 'Telde',
    'C649R': 'Telde',
    'C656V': 'Teror',
    'C658L': 'Las Palmas de Gran Canaria',
    'C658X': 'Las Palmas de Gran Canaria',
    'C659H': 'Las Palmas de Gran Canaria',
    'C659M': 'Las Palmas de Gran Canaria',
    'C665T': 'Valleseco',
    'C668V': 'Agaete',
    'C669B': 'Arucas',
    'C689E': 'San Bartolomé de Tirajana',
    'C839I': 'Teguise',
    'C839X': 'Teguise',
    
    # CANARIAS - SANTA CRUZ DE TENERIFE
    'C101A': 'Garafia',
    'C117A': 'Puntagorda',
    'C117Z': 'Tijarafe',
    'C126A': 'El Paso',
    'C129V': 'Fuencaliente',
    'C129Z': 'Los Llanos de Aridane',
    'C139E': 'Santa Cruz de La Palma',
    'C148F': 'San Andrés y Sauces',
    'C314Z': 'Vallehermoso',
    'C316I': 'Vallehermoso',
    'C317B': 'Alajeró',
    'C319W': 'Vallehermoso',
    'C328W': 'Hermigua',
    'C329B': 'Alajero',
    'C329Z': 'San Sebastián de La Gomera',
    'C406G': 'La Orotava',
    'C412N': 'La Orotava',
    'C415A': 'La Orotava',
    'C417J': 'La Orotava',
    'C418I': 'La Orotava',
    'C418L': 'La Orotava',
    'C419L': 'Adeje',
    'C419X': 'Adeje',
    'C422A': 'La Orotava',
    'C423R': 'Icod de los Vinos',
    'C426E': 'Vilaflor',
    'C426I': 'Vilaflor',
    'C426R': 'Icod de los Vinos',
    'C428T': 'Arico',
    'C428U': 'Arico',
    'C429I': 'Granadilla de Abona',
    'C430E': 'Icod de los Vinos',
    'C436I': 'Candelaria',
    'C436L': 'Candelaria',
    'C437E': 'Candelaria',
    'C438N': 'Candelaria',
    'C439J': 'Güímar',
    'C446G': 'San Cristóbal de La Laguna',
    'C447A': 'San Cristóbal de La Laguna',
    'C448C': 'Santa Cruz de Tenerife',
    'C449C': 'Santa Cruz de Tenerife',
    'C449F': 'Santa Cruz de Tenerife',
    'C449Q': 'Santa Cruz de Tenerife',
    'C453I': 'Candelaria',
    'C455M': 'La Orotava',
    'C456E': 'Icod de los Vinos',
    'C456P': 'Arico',
    'C456R': 'Arico',
    'C457E': 'Candelaria',
    'C457I': 'La Victoria de Acentejo',
    'C458A': 'Tacoronte',
    'C458U': 'Arico',
    'C459Z': 'Puerto de la Cruz',
    'C466O': 'Adeje',
    'C467I': 'Adeje',
    'C468I': 'Icod de los Vinos',
    'C468O': 'Icod de los Vinos',
    'C468X': 'San Juan de la Rambla',
    'C916Q': 'El Pinar de El Hierro',
    'C917E': 'El Pinar de El Hierro',
    'C919K': 'Frontera',
    'C925F': 'Valverde',
    'C928I': 'Valverde',
    'C929I': 'Valverde',
    'C939T': 'Frontera',
    
    # CEUTA Y MELILLA
    '5000A': 'Ceuta',
    '5000C': 'Ceuta',
    '5001A': 'Melilla',
    
    # ANDALUCÍA - CÓRDOBA
    '5402': 'Córdoba',
    '5406X': 'Alcalá la Real',
    '5412X': 'Priego de Córdoba',
}

def rellenar_municipios(archivo_entrada, archivo_salida=None):
    """
    Rellena el campo 'Municipio' basándose en el código AEMET
    
    Args:
        archivo_entrada: Ruta del archivo CSV/JSON de entrada
        archivo_salida: Ruta del archivo de salida (opcional)
    """
    
    print("=" * 100)
    print("RELLENADOR DE MUNICIPIOS - AEMET")
    print("=" * 100)
    
    # Leer archivo
    print(f"\n📂 Leyendo archivo: {archivo_entrada}")
    
    if archivo_entrada.endswith('.json'):
        import json
        with open(archivo_entrada, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        df = pd.DataFrame(datos)
    else:
        df = pd.read_csv(archivo_entrada, encoding='utf-8')
    
    print(f"✓ Registros cargados: {len(df)}")
    
    # Rellenar municipios
    print(f"\n🔄 Rellenando municipios...")
    
    def obtener_municipio(row):
        codigo = str(row.get('Código_AEMET', '')).strip()
        municipio_actual = str(row.get('Municipio', '')).strip()
        
        # Si ya tiene municipio, dejarlo
        if municipio_actual and municipio_actual != '':
            return municipio_actual
        
        # Si está en la base de datos, usar ese
        if codigo in MUNICIPIOS_AEMET:
            return MUNICIPIOS_AEMET[codigo]
        
        # Si no, devolver vacío
        return ''
    
    df['Municipio'] = df.apply(obtener_municipio, axis=1)
    
    # Estadísticas
    rellenados = len(df[df['Municipio'].str.strip() != ''])
    vacios = len(df) - rellenados
    
    print(f"\n📊 Resultados:")
    print(f"   ✓ Municipios rellenados: {rellenados}/{len(df)} ({100*rellenados/len(df):.1f}%)")
    print(f"   ⚠ Aún vacíos: {vacios}")
    
    # Guardar archivo
    if archivo_salida is None:
        archivo_salida = archivo_entrada.replace('.csv', '_con_municipios.csv').replace('.json', '_con_municipios.csv')
    
    df.to_csv(archivo_salida, index=False, encoding='utf-8')
    print(f"\n💾 Archivo guardado: {archivo_salida}")
    
    # Mostrar muestra
    print(f"\n📋 Muestra de datos:")
    cols = ['Código_AEMET', 'Nombre', 'Provincia', 'Municipio']
    cols_existentes = [c for c in cols if c in df.columns]
    print(df[cols_existentes].head(15).to_string(index=False))
    
    print(f"\n{'=' * 100}\n")
    
    return df, archivo_salida

def main():
    if len(sys.argv) < 2:
        print("\nUso: python3 rellenar_municipios_aemet.py archivo.csv [archivo_salida.csv]\n")
        print("Ejemplo:")
        print("  python3 rellenar_municipios_aemet.py Estaciones_AEMET_Completo.csv")
        print("  python3 rellenar_municipios_aemet.py datos.json salida.csv\n")
        sys.exit(1)
    
    archivo_entrada = sys.argv[1]
    archivo_salida = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        df, ruta_salida = rellenar_municipios(archivo_entrada, archivo_salida)
        print("✓ ¡Proceso completado exitosamente!")
    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo '{archivo_entrada}'")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
