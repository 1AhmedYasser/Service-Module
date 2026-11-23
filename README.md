# Bürokratt's Service Module

Bürokratt's Service Module is a tool to help primarily product owners in collaboration with customer support agents/service managers to create, edit and otherwise manipulate Bürokratt's e-services via a graphical user interface. This includes setting up Ruuter- and Rasa-based Rules, making X-road / REST / database requests where and when appropriate and so forth.

Service Module focuses on the part of creation of any service where Bürokratt users can define service endpoints (i.e API or X-Road) whereas Training Module focuses on Rasa's side.

# Scope

This repo will primarily contain:

1. Architectural and other documentation;
2. Docker Compose file to set up and run Bürokratt's Service Module as a fully functional service;
3. Tests specific to Bürokratt's Service Module.

## Dev setup

- Make sure that env variable REACT_APP_LOCAL is set to true(default).

- Clone [Ruuter](https://github.com/buerokratt/Ruuter)

- Navigate to Ruuter and build the image `docker build -t ruuter .`

- Clone [Resql](https://github.com/buerokratt/Resql)

- Navigate to Resql and build the image `docker build -t resql .`

- Clone [Data Mapper](https://github.com/buerokratt/DataMapper)

- Navigate to Data Mapper and build the image `docker build -t data-mapper .`

- Clone [TIM](https://github.com/buerokratt/TIM)

- Navigate to TIM and build the image `docker build -t tim .`

- Clone [SiGA](https://github.com/open-eid/SiGa)

- Set java version to 17

- Navigate to SiGA & run `./mvnw clean install`

- Navigate to SiGA & run `./mvnw spring-boot:build-image -pl siga-webapp -DskipTests`

- Copy docker folder from SiGA directory & paste it into current repo directory.

- Clone [SiGA Demo](https://github.com/open-eid/SiGa-demo-application)

- Build demo docker image using `./mvnw spring-boot:build-image -DskipTests`

- Navigate to current repo and run `./docker/tls/generate-certificates.sh`

- Navigate to current repo and run `docker-compose $(find docker-* | sed -e 's/^/-f /') up -d`

- Go to <https://localhost:3001>

**Training Module GUI setup in Service Module**

- Clone [Training Module](https://github.com/buerokratt/Training-Module)
- Training Module `.env` file includes REACT_APP_SERVICE_MODULE_GUI_BASE_URL
- In Training Module run: `docker-compose up -d`
  - Training module uses the same network as Service Module

Currently, Header and Main Navigation used as external components, they are defined as dependency in package.json

```
 "@buerokrat-ria/header": "^0.0.1"
 "@buerokrat-ria/menu": "^0.0.1"
 "@buerokrat-ria/styles": "^0.0.1"
```

### Database setup

To use the local services database, do the following:

1. Open `docker-compose.yml`, find `resql` service and change the value of environment variable `sqlms.datasources.[0].jdbcUrl` to `jdbc:postgresql://database:5432/services_db`.
2. Run `./migrate.sh` to run migrations.
3. Start the project normally with `docker compose up -d`.

Extras:

- For setting up the users database initially, run
  `docker run --platform linux/amd64 --network=bykstack riaee/byk-users-db:liquibase20220615 --url=jdbc:postgresql://database:5432/users_db --username=byk --password=01234 --changelog-file=./master.yml update`
- When creating new migrations, use the helper `./create-migration.sh name-of-migration` which will create a timestamped file in the correct directory and add the required headers

### Open Search

- To Initialize Open Search run `./deploy-opensearch.sh <URL> <AUTH> <Is Mock Allowed - Default false>`
- To Use Opensearch locally run `./deploy-opensearch.sh http://localhost:9200 admin:admin true`

### TIM

- if you are running `Locally` then you need to curl the login request or run it on postman first to create and store the cookie in TIM and then on the browser create the cookie manully in the browser with name `customJwtCookie` and the value return from the curl
  the curl request is as follows:

```
curl -X POST -H "Content-Type: application/json" -d '{
  "login": "EE30303039914",
  "password": "OK"
}' http://localhost:8086/services/auth/login
```

### Vault

- Backend secrets (e.g. the Azure Search API key) are read from HashiCorp Vault through a Vault Agent, not from `constants.ini`
- `docker compose up -d` also starts a local Vault (`service-module-vault`, `service-module-vault-init`, `vault-agent-service-module`), so Service Module runs standalone
- When running together with Buerokratt-Chatbot's shared Vault, stop the local one first: `docker compose stop service-module-vault vault-agent-service-module`
- To add a secret locally:

```
docker exec service-module-vault sh -c 'VAULT_TOKEN=$(awk "/^Initial Root Token:/ {print \$4}" /vault/data/init.txt) \
  vault kv put secret/service-module/prod/azure-search api_key=<key>'
```

- Policies, covered flows, failure modes and verification are described in [VAULT README](./docs/vault.md)

### Kubernetes deployment

For production deploying on kubernetes use this the variable [`REACT_APP_MENU_JSON`](https://github.com/buerokratt/NoOps/blob/dev/Kubernetes/Modules/Service-Module/templates/deployment-byk-services-gui.yaml) with the value:

```
"[{\"id\":\"conversations\",\"label\":{\"et\":\"Vestlused\",\"en\":\"Conversations\"},\"path\":\"/chat\",\"children\":[{\"label\":{\"et\":\"Vastamata\",\"en\":\"Unanswered\"},\"path\":\"/unanswered\"},{\"label\":{\"et\":\"Aktiivsed\",\"en\":\"Active\"},\"path\":\"/active\"},{\"label\":{\"et\":\"Ootel\",\"en\":\"Pending\"},\"path\":\"/pending\"},{\"label\":{\"et\":\"Ajalugu\",\"en\":\"History\"},\"path\":\"/history\"}]},{\"id\":\"training\",\"label\":{\"et\":\"Treening\",\"en\":\"Training\"},\"path\":\"/training\",\"children\":[{\"label\":{\"et\":\"Treening\",\"en\":\"Training\"},\"path\":\"/training\",\"children\":[{\"label\":{\"et\":\"Teemad\",\"en\":\"Themes\"},\"path\":\"/training/intents\"},{\"hidden\":true,\"label\":{\"et\":\"Avalikud teemad\",\"en\":\"Public themes\"},\"path\":\"/training/common-intents\"},{\"label\":{\"et\":\"Teemade järeltreenimine\",\"en\":\"Post training themes\"},\"path\":\"/training/intents-followup-training\"},{\"label\":{\"et\":\"Vastused\",\"en\":\"Answers\"},\"path\":\"/training/responses\"},{\"label\":{\"et\":\"Reeglid\",\"en\":\"Rules\"},\"path\":\"/training/rules\"},{\"hidden\":true,\"label\":{\"et\":\"Konfiguratsioon\",\"en\":\"Configuration\"},\"path\":\"/training/configuration\"},{\"label\":{\"et\":\"Vormid\",\"en\":\"Forms\"},\"path\":\"/training/forms\"},{\"label\":{\"et\":\"Mälukohad\",\"en\":\"Slots\"},\"path\":\"/training/slots\"},{\"hidden\":true,\"label\":{\"et\":\"Automatic Teenused\",\"en\":\"Automatic Services\"},\"path\":\"/auto-services\"}]},{\"label\":{\"et\":\"Ajaloolised vestlused\",\"en\":\"Historical conversations\"},\"path\":\"/history\",\"children\":[{\"label\":{\"et\":\"Ajalugu\",\"en\":\"History\"},\"path\":\"/history/history\"},{\"hidden\":true,\"label\":{\"et\":\"Pöördumised\",\"en\":\"Appeals\"},\"path\":\"/history/appeal\"}]},{\"label\":{\"et\":\"Mudelipank ja analüütika\",\"en\":\"Modelbank and analytics\"},\"path\":\"/analytics\",\"children\":[{\"label\":{\"et\":\"Teemade ülevaade\",\"en\":\"Overview of topics\"},\"path\":\"/analytics/overview\"},{\"label\":{\"et\":\"Mudelite võrdlus\",\"en\":\"Comparison of models\"},\"path\":\"/analytics/models\"},{\"hidden\":true,\"label\":{\"et\":\"Testlood\",\"en\":\"testTracks\"},\"path\":\"/analytics/testcases\"}]},{\"label\":{\"et\":\"Treeni uus mudel\",\"en\":\"Train new model\"},\"path\":\"/train-new-model\"}]},{\"id\":\"analytics\",\"label\":{\"et\":\"Analüütika\",\"en\":\"Analytics\"},\"path\":\"/analytics\",\"children\":[{\"label\":{\"et\":\"Ülevaade\",\"en\":\"Overview\"},\"path\":\"/overview\"},{\"label\":{\"et\":\"Vestlused\",\"en\":\"Chats\"},\"path\":\"/chats\"},{\"label\":{\"et\":\"Tagasiside\",\"en\":\"Feedback\"},\"path\":\"/feedback\"},{\"label\":{\"et\":\"Avaandmed\",\"en\":\"Reports\"},\"path\":\"/reports\"}]},{\"id\":\"services\",\"hidden\":true,\"label\":{\"et\":\"Teenused\",\"en\":\"Services\"},\"path\":\"/services\",\"children\":[{\"label\":{\"et\":\"Ülevaade\",\"en\":\"Overview\"},\"path\":\"/overview\"},{\"label\":{\"et\":\"Uus teenus\",\"en\":\"New Service\"},\"path\":\"/newService\"},{\"label\":{\"et\":\"Automatic Teenused\",\"en\":\"Automatic Services\"},\"path\":\"/auto-services\"},{\"label\":{\"et\":\"Probleemsed teenused\",\"en\":\"Faulty Services\"},\"path\":\"/faultyServices\"}]},{\"id\":\"settings\",\"label\":{\"et\":\"Haldus\",\"en\":\"Administration\"},\"path\":\"/settings\",\"children\":[{\"label\":{\"et\":\"Kasutajad\",\"en\":\"Users\"},\"path\":\"/users\"},{\"label\":{\"et\":\"Vestlusbot\",\"en\":\"Chatbot\"},\"path\":\"/chatbot\",\"children\":[{\"label\":{\"et\":\"Seaded\",\"en\":\"Settings\"},\"path\":\"/chatbot/settings\"},{\"label\":{\"et\":\"Tervitussõnum\",\"en\":\"Welcome message\"},\"path\":\"/chatbot/welcome-message\"},{\"label\":{\"et\":\"Välimus ja käitumine\",\"en\":\"Appearance and behavior\"},\"path\":\"/chatbot/appearance\"},{\"label\":{\"et\":\"Erakorralised teated\",\"en\":\"Emergency notices\"},\"path\":\"/chatbot/emergency-notices\"}]},{\"label\":{\"et\":\"Asutuse tööaeg\",\"en\":\"Office opening hours\"},\"path\":\"/working-time\"},{\"label\":{\"et\":\"Sessiooni pikkus\",\"en\":\"Session length\"},\"path\":\"/session-length\"}]},{\"id\":\"monitoring\",\"hidden\":true,\"label\":{\"et\":\"Seire\",\"en\":\"Monitoring\"},\"path\":\"/monitoring\",\"children\":[{\"label\":{\"et\":\"Aktiivaeg\",\"en\":\"Working hours\"},\"path\":\"/uptime\"}]}]"
```

like this:

```
            - name: REACT_APP_MENU_JSON
              value: "[{\"id\":\"conversations\",\"label\":{\"et\":\"Vestlused\",\"en\":\"Conversations\"},\"path\":\"/chat\",\"children\":[{\"label\":{\"et\":\"Vastamata\",\"en\":\"Unanswered\"},\"path\":\"/unanswered\"},{\"label\":{\"et\":\"Aktiivsed\",\"en\":\"Active\"},\"path\":\"/active\"},{\"label\":{\"et\":\"Ootel\",\"en\":\"Pending\"},\"path\":\"/pending\"},{\"label\":{\"et\":\"Ajalugu\",\"en\":\"History\"},\"path\":\"/history\"}]},{\"id\":\"training\",\"label\":{\"et\":\"Treening\",\"en\":\"Training\"},\"path\":\"/training\",\"children\":[{\"label\":{\"et\":\"Treening\",\"en\":\"Training\"},\"path\":\"/training\",\"children\":[{\"label\":{\"et\":\"Teemad\",\"en\":\"Themes\"},\"path\":\"/training/intents\"},{\"hidden\":true,\"label\":{\"et\":\"Avalikud teemad\",\"en\":\"Public themes\"},\"path\":\"/training/common-intents\"},{\"label\":{\"et\":\"Teemade järeltreenimine\",\"en\":\"Post training themes\"},\"path\":\"/training/intents-followup-training\"},{\"label\":{\"et\":\"Vastused\",\"en\":\"Answers\"},\"path\":\"/training/responses\"},{\"label\":{\"et\":\"Reeglid\",\"en\":\"Rules\"},\"path\":\"/training/rules\"},{\"hidden\":true,\"label\":{\"et\":\"Konfiguratsioon\",\"en\":\"Configuration\"},\"path\":\"/training/configuration\"},{\"label\":{\"et\":\"Vormid\",\"en\":\"Forms\"},\"path\":\"/training/forms\"},{\"label\":{\"et\":\"Mälukohad\",\"en\":\"Slots\"},\"path\":\"/training/slots\"},{\"hidden\":true,\"label\":{\"et\":\"Automatic Teenused\",\"en\":\"Automatic Services\"},\"path\":\"/auto-services\"}]},{\"label\":{\"et\":\"Ajaloolised vestlused\",\"en\":\"Historical conversations\"},\"path\":\"/history\",\"children\":[{\"label\":{\"et\":\"Ajalugu\",\"en\":\"History\"},\"path\":\"/history/history\"},{\"hidden\":true,\"label\":{\"et\":\"Pöördumised\",\"en\":\"Appeals\"},\"path\":\"/history/appeal\"}]},{\"label\":{\"et\":\"Mudelipank ja analüütika\",\"en\":\"Modelbank and analytics\"},\"path\":\"/analytics\",\"children\":[{\"label\":{\"et\":\"Teemade ülevaade\",\"en\":\"Overview of topics\"},\"path\":\"/analytics/overview\"},{\"label\":{\"et\":\"Mudelite võrdlus\",\"en\":\"Comparison of models\"},\"path\":\"/analytics/models\"},{\"hidden\":true,\"label\":{\"et\":\"Testlood\",\"en\":\"testTracks\"},\"path\":\"/analytics/testcases\"}]},{\"label\":{\"et\":\"Treeni uus mudel\",\"en\":\"Train new model\"},\"path\":\"/train-new-model\"}]},{\"id\":\"analytics\",\"label\":{\"et\":\"Analüütika\",\"en\":\"Analytics\"},\"path\":\"/analytics\",\"children\":[{\"label\":{\"et\":\"Ülevaade\",\"en\":\"Overview\"},\"path\":\"/overview\"},{\"label\":{\"et\":\"Vestlused\",\"en\":\"Chats\"},\"path\":\"/chats\"},{\"label\":{\"et\":\"Tagasiside\",\"en\":\"Feedback\"},\"path\":\"/feedback\"},{\"label\":{\"et\":\"Avaandmed\",\"en\":\"Reports\"},\"path\":\"/reports\"}]},{\"id\":\"services\",\"hidden\":true,\"label\":{\"et\":\"Teenused\",\"en\":\"Services\"},\"path\":\"/services\",\"children\":[{\"label\":{\"et\":\"Ülevaade\",\"en\":\"Overview\"},\"path\":\"/overview\"},{\"label\":{\"et\":\"Uus teenus\",\"en\":\"New Service\"},\"path\":\"/newService\"},{\"label\":{\"et\":\"Automatic Teenused\",\"en\":\"Automatic Services\"},\"path\":\"/auto-services\"},{\"label\":{\"et\":\"Probleemsed teenused\",\"en\":\"Faulty Services\"},\"path\":\"/faultyServices\"}]},{\"id\":\"settings\",\"label\":{\"et\":\"Haldus\",\"en\":\"Administration\"},\"path\":\"/settings\",\"children\":[{\"label\":{\"et\":\"Kasutajad\",\"en\":\"Users\"},\"path\":\"/users\"},{\"label\":{\"et\":\"Vestlusbot\",\"en\":\"Chatbot\"},\"path\":\"/chatbot\",\"children\":[{\"label\":{\"et\":\"Seaded\",\"en\":\"Settings\"},\"path\":\"/chatbot/settings\"},{\"label\":{\"et\":\"Tervitussõnum\",\"en\":\"Welcome message\"},\"path\":\"/chatbot/welcome-message\"},{\"label\":{\"et\":\"Välimus ja käitumine\",\"en\":\"Appearance and behavior\"},\"path\":\"/chatbot/appearance\"},{\"label\":{\"et\":\"Erakorralised teated\",\"en\":\"Emergency notices\"},\"path\":\"/chatbot/emergency-notices\"}]},{\"label\":{\"et\":\"Asutuse tööaeg\",\"en\":\"Office opening hours\"},\"path\":\"/working-time\"},{\"label\":{\"et\":\"Sessiooni pikkus\",\"en\":\"Session length\"},\"path\":\"/session-length\"}]},{\"id\":\"monitoring\",\"hidden\":true,\"label\":{\"et\":\"Seire\",\"en\":\"Monitoring\"},\"path\":\"/monitoring\",\"children\":[{\"label\":{\"et\":\"Aktiivaeg\",\"en\":\"Working hours\"},\"path\":\"/uptime\"}]}]"
```

## Code quality

### Formatting

```bash
npm run format         # Check if the code is formatted, without making changes
npm run format:fix     # Format the code
```

### Linting

```bash
npm run lint           # Check for linting issues, without making changes
npm run lint:fix       # Automatically fix linting issues
```

### Tests

Tests are written in TypeScript (and the project should be migrated to TypeScript in the future too). Available npm scripts:

```bash
npm test               # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:coverage  # Run tests with coverage
```

### SQL

The repository uses [SQLFluff](https://sqlfluff.com/) for linting and formatting SQL files. To use SQLFluff:

1. Install SQLFluff: `pipx install sqlfluff`.
2. Run `sqlfluff lint <some-path>`.
3. Additionally, using an IDE extension is highly recommended. For [VSCode](https://marketplace.visualstudio.com/items?itemName=dorzey.vscode-sqlfluff) or [Jetbrains editors](https://plugins.jetbrains.com/plugin/20494-sqlfluff-linter-community-edition).

## Environment variables

| Ruuter Variable                    | GUI Variable                               | Description                                          | Required | Default Value       |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- | -------- | ------------------- |
| `application.apiRequestTestingKey` | `REACT_APP_RUUTER_SERVICES_TESTING_HEADER` | `x-ruuter-testing` header value for testing services |          | `voorshpellhappilo` |
| `SERVICE_VAULT_AGENT` (`constants.ini`) | | Service Module Vault Agent proxy URL | Yes | `http://vault-agent-service-module:8205` |
| `SERVICE_VAULT_SECRETS_PATH` (`constants.ini`) | | Vault KV prefix for this environment (`service-module/prod` or `service-module/test`) | Yes | `service-module/prod` |

## Intent Classification 

Flow is desribed in [INTENT CLASSIFICATION README](./docs/INTENT_CLASSIFICATION.MD)
