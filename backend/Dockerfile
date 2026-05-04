# Use an official Python runtime as a parent image
FROM python:3.13-slim
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

# Copy requirements.txt into the container at /app
COPY requirements.txt /app/
# Copy the New Relic configuration file into the container
COPY ml_newrelic.ini /app/

# Install system dependencies (minimal for this service)
RUN apt-get update -qq -y && \
    apt-get install -y --fix-missing \
        curl \
        wget \
        build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Chromium + its system libraries for the local scrape backend.
# --with-deps pulls libnss3, libgbm1, etc. so headed/headless Chromium runs.
RUN playwright install chromium --with-deps

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Copy the application code
COPY ./API /app

ENV LANG=C.UTF-8
ENV RUNNING_IN_DOCKER=true

# run.sh reads gunicorn tuning from KNOWLEDGE_ROBOT_* env vars at startup.
ENTRYPOINT ["bash", "run.sh"]