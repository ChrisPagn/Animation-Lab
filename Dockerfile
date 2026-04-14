# ================================
# Stage 1 : Build des assets Vite
# ================================
FROM node:22-alpine AS node-builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ================================
# Stage 2 : App Laravel (PHP)
# ================================
FROM php:8.3-fpm-alpine AS php-base

# Extensions PHP nécessaires pour Laravel
RUN apk add --no-cache \
    nginx \
    curl \
    zip unzip \
    libzip-dev \
    oniguruma-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring zip bcmath opcache

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Dépendances PHP
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Copier le code source
COPY . .

# Copier les assets buildés par Vite
COPY --from=node-builder /app/public/build ./public/build

# Permissions
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Config Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["sh", "-c", "php-fpm -D && nginx -g 'daemon off;'"]
