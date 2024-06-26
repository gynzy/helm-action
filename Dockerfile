FROM alpine:3.18.0

ENV BASE_URL="https://get.helm.sh"

ENV HELM_2_FILE="helm-v2.15.2-linux-amd64.tar.gz"
ENV HELM_3_FILE="helm-v3.11.1-linux-amd64.tar.gz"

# coreutils is needed helm3 ttl plugin
# git is needed to install a helm3 plugin
# python3 needed by gcloud
RUN apk add --no-cache ca-certificates \
    --repository http://dl-3.alpinelinux.org/alpine/edge/community/ \
    jq curl bash nodejs python3 git coreutils && \
    # Install helm version 2:
    curl -L ${BASE_URL}/${HELM_2_FILE} |tar xvz && \
    mv linux-amd64/helm /usr/bin/helm && \
    chmod +x /usr/bin/helm && \
    rm -rf linux-amd64 && \
    # Install helm version 3:
    curl -L ${BASE_URL}/${HELM_3_FILE} |tar xvz && \
    mv linux-amd64/helm /usr/bin/helm3 && \
    chmod +x /usr/bin/helm3 && \
    rm -rf linux-amd64 && \
    # Init version 2 helm:
    helm init --client-only --stable-repo-url https://charts.helm.sh/stable && \
    # Install helm3 ttl plugin for temporary pr deploys \
    helm3 plugin install https://github.com/gynzy/helm-release-plugin --version 06e297a76878eec0a54c45e1877dc981b665b621

# Install google gcloud sdk
RUN curl -sSL https://dl.google.com/dl/cloudsdk/channels/rapid/install_google_cloud_sdk.bash | PREFIX=/opt/ bash && \
    # Install new kubernetes authentication method and kubectl \
    /opt/google-cloud-sdk/bin/gcloud components install gke-gcloud-auth-plugin kubectl && \
    # Symlink default location to actually installed location \
    mkdir -p  /usr/lib/google-cloud-sdk/bin && \
    ln -s /opt/google-cloud-sdk/bin/gcloud /usr/lib/google-cloud-sdk/bin/gcloud && \
    ln -s /opt/google-cloud-sdk/bin/kubectl /usr/lib/google-cloud-sdk/bin/kubectl

ENV PYTHONPATH "/usr/lib/python3.8/site-packages/"
ENV PATH $PATH:/opt/google-cloud-sdk/bin

COPY . /usr/src/
ENTRYPOINT ["node", "/usr/src/index.js"]
