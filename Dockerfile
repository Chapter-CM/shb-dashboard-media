FROM gitlab-nhs.shb.com.vn:5050/omnichannel/omni-devops/ci-template/node:20-nginx-amd AS builder

WORKDIR /app

ARG JIRA_DOMAIN
ARG JIRA_EMAIL
ARG JIRA_TOKEN
ARG JIRA_PROJECT

ENV JIRA_DOMAIN=$JIRA_DOMAIN
ENV JIRA_EMAIL=$JIRA_EMAIL
ENV JIRA_TOKEN=$JIRA_TOKEN
ENV JIRA_PROJECT=$JIRA_PROJECT

COPY package*.json ./
RUN npm install

COPY . .

RUN npm install --no-save react@18 react-dom@18 @babel/standalone prop-types@15.8.1 recharts@2.12.7 html2canvas@1.4.1 jspdf@2.5.1 && \
    mkdir -p public/vendors && \
    cp node_modules/react/umd/react.production.min.js public/vendors/ && \
    cp node_modules/react-dom/umd/react-dom.production.min.js public/vendors/ && \
    cp node_modules/@babel/standalone/babel.min.js public/vendors/ && \
    cp node_modules/prop-types/prop-types.min.js public/vendors/ && \
    cp node_modules/recharts/umd/Recharts.js public/vendors/Recharts.min.js && \
    cp node_modules/html2canvas/dist/html2canvas.min.js public/vendors/ && \
    cp node_modules/jspdf/dist/jspdf.umd.min.js public/vendors/

RUN node sync.js

FROM gitlab-nhs.shb.com.vn:5050/omnichannel/omni-devops/ci-template/node:20-nginx-amd

COPY --from=builder /app/public /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
