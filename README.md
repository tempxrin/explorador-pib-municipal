# PIB Municipal

Explore os dados de PIB de todos os 5.570 municípios brasileiros, diretamente da API do IBGE.

## Funcionalidades

- **Busca por município**: pesquisa com autocomplete e resultados detalhados
- **Dashboard interativo**: gráficos de top 10, distribuição por faixas e mapa de calor
- **Filtros por região e estado**: refine os rankings
- **Mapa de calor**: visualize a distribuição geográfica do PIB per capita
- **Tema dark/light**: alternância com persistência
- **Responsivo**: funciona em desktop e mobile

## Dados

- **Fonte**: IBGE Cidades (API oficial)
- **Indicadores**: PIB per capita (47001) e PIB total (46997)
- **Ano**: 2023
- **Municípios**: 5.570

## Como rodar

```bash
# Instalar dependência
pip install requests

# Iniciar servidor
cd api
python server.py

# Acessar
# http://localhost:3000
```

## Stack

- **Backend**: Python (servidor HTTP + cache)
- **Frontend**: HTML, CSS, JavaScript
- **Gráficos**: Chart.js
- **Mapa**: Leaflet.js + GeoJSON IBGE
- **Fontes**: Space Grotesk + DM Sans
