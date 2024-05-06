import { FC, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Card, Modal, Track } from "..";
import DataTable from "../DataTable";

import useServiceListStore from "store/services.store";
import ConnectServiceToIntentModel from "pages/Integration/ConnectServiceToIntentModel";
import { Intent } from "types/Intent";
import { Trigger } from "types/Trigger";
import { getColumns } from "./columns";
import "../../styles/main.scss";
import "./ServicesTable.scss";

type ServicesTableProps = {
  isCommon?: boolean;
};

const ServicesTable: FC<ServicesTableProps> = ({ isCommon = false }) => {
  const { t } = useTranslation();
  const [isDeletePopupVisible, setIsDeletePopupVisible] = useState(false);
  const [isStatePopupVisible, setIsStatePopupVisible] = useState(false);
  const [isReadyPopupVisible, setIsReadyPopupVisible] = useState(false);
  const [isIntentConnectionPopupVisible, setIsIntentConnectionPopupVisible] = useState(false);
  const [popupText, setPopupText] = useState("");
  const [readyPopupText, setReadyPopupText] = useState("");
  const [isReadyStatusChecking, setIsReadyStatusChecking] = useState(false);
  const services = useServiceListStore((state) => state.services.filter((x) => x.isCommon === isCommon));
  const navigate = useNavigate();
  const [selectedConnectionTrigger, setSelectedConnectionTrigger] = useState<Trigger | undefined>();

  const checkIntentConnection = () => {
    useServiceListStore.getState().checkServiceIntentConnection(
      (response) => {
        setSelectedConnectionTrigger(response);
        setIsReadyStatusChecking(false);
        if (response.status === "pending") {
          setReadyPopupText(t("overview.popup.connectionPending").toString());
        } else {
          setReadyPopupText(t("overview.popup.setActive").toString());
        }
      },
      () => {
        setIsReadyStatusChecking(false);
        setReadyPopupText(t("overview.popup.intentNotConnected").toString());
      }
    );
  };
  
  const columns = useMemo(() => getColumns({
    isCommon,
    navigate,
    checkIntentConnection,
    hideDeletePopup: () => setIsDeletePopupVisible(true),
    showStatePopup: (text: string) => {
      setPopupText(text);
      setIsStatePopupVisible(true);
    },
    showReadyPopup: () => {
      setIsReadyStatusChecking(true);
      setIsReadyPopupVisible(true);
    }
  }), []);

  const changeServiceState = (activate: boolean = false, draft: boolean = false) => {
    useServiceListStore.getState().changeServiceState(
      () => {
        setIsReadyPopupVisible(false);
        setIsStatePopupVisible(false);
      },
      t("overview.service.toast.updated"),
      t("overview.service.toast.failed.state"),
      activate,
      draft
    );
  };

  const deleteSelectedService = () => {
    useServiceListStore
      .getState()
      .deleteSelectedService(
        () => setIsDeletePopupVisible(false),
        t("overview.service.toast.deleted"),
        t("overview.service.toast.failed.delete")
      );
  };

  const requestServiceIntentConnection = (intent: string) => {
    useServiceListStore
      .getState()
      .requestServiceIntentConnection(
        () => setIsIntentConnectionPopupVisible(false),
        t("overview.service.toast.connectedToIntentSuccessfully"),
        t("overview.service.toast.failed.failedToConnectToIntent"),
        intent
      );
  };

  const cancelConnectionRequest = () => {
    if (selectedConnectionTrigger) {
      useServiceListStore
        .getState()
        .cancelConnectionRequest(
          () => setIsReadyPopupVisible(false),
          t("overview.service.toast.cancelledConnection"),
          t("overview.service.toast.failed.cancelledConnection"),
          selectedConnectionTrigger
        );
    }
  };

  const getChangeServiceStateButtonTitle = () => {
    if(popupText === t("overview.popup.setInactive"))
      return t("overview.popup.deactivate");
    if(popupText === t("overview.popup.setReady"))
      return t("overview.popup.setState");
    return t("overview.popup.activate");
  }

  const getActiveAndConnectionButton = () => {
    if(readyPopupText === t("overview.popup.setActive")) {
      return <Button onClick={() => changeServiceState(true)}>{t("overview.popup.activateService")}</Button>
    }
    if(readyPopupText === t("overview.popup.connectionPending")) {
      return <Button onClick={cancelConnectionRequest}>{t("overview.popup.cancelRequest")}</Button>
    }
    return (
      <Button
        onClick={() => {
          setIsReadyPopupVisible(false);
          setIsIntentConnectionPopupVisible(true);
        }}
      >
        {t("overview.popup.connectToIntent")}
      </Button>
    )
  }

  return (
    <Card>
      {isDeletePopupVisible && (
        <Modal title={t("overview.popup.delete")} onClose={() => setIsDeletePopupVisible(false)}>
          <Track justify="end" gap={16}>
            <Button appearance="secondary" onClick={() => setIsDeletePopupVisible(false)}>
              {t("overview.cancel")}
            </Button>
            <Button appearance="error" onClick={deleteSelectedService}>
              {t("overview.delete")}
            </Button>
          </Track>
        </Modal>
      )}
      {isStatePopupVisible && (
        <Modal title={popupText} onClose={() => setIsStatePopupVisible(false)}>
          <Track justify="end" gap={16}>
            <Button appearance="secondary" onClick={() => setIsStatePopupVisible(false)}>
              {t("overview.cancel")}
            </Button>
            {popupText === t("overview.popup.setInactive") && (
              <Button onClick={() => changeServiceState(false, true)}>{t("overview.popup.setToDraft")}</Button>
            )}
            <Button onClick={() => changeServiceState()}>
              {getChangeServiceStateButtonTitle()}
            </Button>
          </Track>
        </Modal>
      )}
      {isReadyPopupVisible && (
        <Modal title={isReadyStatusChecking ? null : readyPopupText} onClose={() => setIsReadyPopupVisible(false)}>
          {isReadyStatusChecking ? (
            <Track justify="center" gap={16} direction="vertical">
              <label>{t("overview.popup.checking")}</label>
              <div className="loader" />
            </Track>
          ) : (
            <Track justify="end" gap={16}>
              <Button appearance="secondary" onClick={() => setIsReadyPopupVisible(false)}>
                {t("overview.cancel")}
              </Button>
              {readyPopupText != t("overview.popup.connectionPending").toString() && (
                <Button onClick={() => changeServiceState()}>{t("overview.popup.setToDraft")}</Button>
              )}
              {getActiveAndConnectionButton()}
            </Track>
          )}
        </Modal>
      )}
      {isIntentConnectionPopupVisible && (
        <ConnectServiceToIntentModel
          onModalClose={() => setIsIntentConnectionPopupVisible(false)}
          onConnect={(intent: Intent) => requestServiceIntentConnection(intent.intent)}
        />
      )}
      <DataTable sortable data={services} columns={columns} />
    </Card>
  );
};

export default ServicesTable;
