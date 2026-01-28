FROM python:3.11-slim

WORKDIR /app

# Install Network Tools
RUN apt-get update && apt-get install -y \
    iproute2 \
    fping \
    iputils-ping \
    iputils-arping \
    ieee-data \
    avahi-utils \
    samba-common-bin \
    nmap \
    nbtscan \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-u", "main.py"]
