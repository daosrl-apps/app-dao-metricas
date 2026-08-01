#!/bin/bash

# Configuration
APP_DIR="/root/app-dao-metricas"
BACKUP_DIR="/root/backups/app-dao-metricas"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MAX_BACKUPS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy the database from the running container
docker cp dao-metricas-app:/app/Resumen_InterAnual_2026.XLS "$BACKUP_DIR/Resumen_InterAnual_2026_$TIMESTAMP.XLS"

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup de base de datos Excel realizado con éxito." >> "$BACKUP_DIR/backup.log"
else
    echo "[$(date)] ERROR: El backup de la base de datos Excel falló." >> "$BACKUP_DIR/backup.log"
    exit 1
fi

# Rotate backups: keep only the latest $MAX_BACKUPS files
cd "$BACKUP_DIR" || exit
ls -t Resumen_InterAnual_2026_*.XLS 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

echo "[$(date)] Rotación de backups completada." >> "$BACKUP_DIR/backup.log"
