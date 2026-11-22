import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { request } from "./src/api";
import { identificationFromScan } from "./src/barcode";
const credentialsKey = "cc.credentials";
const initial = {
  identificacion: "",
  nombres: "",
  apellidos: "",
  fuerza: "",
  rango: "",
  id_fuerza: "",
  correo: "",
};
function Button({ title, onPress, disabled, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, disabled && s.disabled]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
    </Pressable>
  );
}
function Field({ label, ...props }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        placeholderTextColor="#91a3a7"
        style={s.input}
        {...props}
      />
    </View>
  );
}
function Brand() {
  return (
    <View style={s.brand}>
      <View style={s.brandMark}>
        <Text style={s.brandMarkText}>CC</Text>
      </View>
      <View>
        <Text style={s.brandName}>Consulta Ciudadano</Text>
        <Text style={s.brandSub}>FUERZA PÚBLICA</Text>
      </View>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
function Main() {
  const [screen, setScreen] = useState("login"),
    [identificacion, setId] = useState(""),
    [password, setPassword] = useState(""),
    [remember, setRemember] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [session, setSession] = useState(null),
    [registration, setRegistration] = useState(initial),
    [catalog, setCatalog] = useState({}),
    [result, setResult] = useState(null),
    [manualId, setManualId] = useState(""),
    [scannedId, setScannedId] = useState(""),
    [recoveryEmail, setRecoveryEmail] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [recoveryCode, setRecoveryCode] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [scanPaused, setScanPaused] = useState(false),
    [torch, setTorch] = useState(false),
    [zoom, setZoom] = useState(0),
    [permission, askPermission] = useCameraPermissions(),
    [foreground, setForeground] = useState(true);
  const scanning = useRef(false);
  const changingPassword =
    screen === "changePassword" || screen === "verifyChange";
  const running = useRef(false);
  useEffect(() => {
    SecureStore.getItemAsync(credentialsKey)
      .then((value) => {
        if (value) {
          const saved = JSON.parse(value);
          setId(saved.identificacion);
          setPassword(saved.password);
          setRemember(true);
        }
      })
      .catch(() =>
        setError("No fue posible recuperar las credenciales guardadas."),
      );
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => sub.remove();
  }, []);
  const changeScreen = (next) => {
    if (next !== "scan") scanning.current = true;
    setError("");
    setScreen(next);
  };
  async function run(work) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (error) {
      setError(error.message);
      if (error.status === 401) {
        setSession(null);
        setScreen("login");
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function login() {
    await run(async () => {
      if (!/^\d{5,15}$/.test(identificacion) || !password)
        throw new Error("Ingresa tu identificación y contraseña.");
      const data = await request("/auth/login", {
        method: "POST",
        body: { identificacion, password, canal: "movil" },
      });
      if (remember)
        await SecureStore.setItemAsync(
          credentialsKey,
          JSON.stringify({ identificacion, password }),
          { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
        );
      else await SecureStore.deleteItemAsync(credentialsKey);
      setSession(data);
      setPassword("");
      changeScreen("home");
    });
  }
  async function openRegistration() {
    await run(async () => {
      const data = await request("/catalogos");
      setCatalog(data.rangos);
      setRegistration({
        ...initial,
        fuerza: Object.keys(data.rangos)[0],
        rango: Object.values(data.rangos)[0][0],
      });
      changeScreen("register");
    });
  }
  async function register() {
    await run(async () => {
      if (Object.values(registration).some((v) => !v.trim()))
        throw new Error("Completa todos los campos del registro.");
      if (!/^\d{5,15}$/.test(registration.identificacion))
        throw new Error("La identificación debe tener entre 5 y 15 dígitos.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.correo))
        throw new Error("Revisa el correo electrónico.");
      await request("/auth/registro", { method: "POST", body: registration });
      setId(registration.identificacion);
      setPassword("");
      changeScreen("login");
      Alert.alert(
        "Registro confirmado",
        "Revisa tu correo. Allí encontrarás la contraseña para ingresar.",
      );
    });
  }
  async function startScan() {
    setError("");
    let p;
    try {
      p = permission?.granted ? permission : await askPermission();
    } catch {
      setError(
        "No se pudo abrir la cámara. Intenta nuevamente o ingresa el número manualmente.",
      );
      return;
    }
    if (!p.granted) {
      setError(
        "Autoriza el acceso a la cámara en los ajustes del dispositivo para escanear.",
      );
      return;
    }
    scanning.current = false;
    setScanPaused(false);
    setScannedId("");
    setTorch(false);
    setZoom(0);
    setResult(null);
    changeScreen("scan");
  }
  function openManual() {
    setScannedId("");
    setManualId("");
    setResult(null);
    changeScreen("manual");
  }
  async function consultById(id) {
    await run(async () => {
      try {
        const response = await request(`/consulta/${id}`, {
          token: session.token,
        });
        setResult(response);
        changeScreen("result");
      } catch (error) {
        if (error.status === 404) {
          setResult({ identificacion: id, notFound: true });
          changeScreen("result");
        } else throw error;
      }
    });
  }
  function onBarcode(event) {
    if (scanning.current || busy || !foreground || screen !== "scan") return;
    scanning.current = true;
    setScanPaused(true);
    setTorch(false);
    try {
      setScannedId(identificationFromScan(event));
      changeScreen("confirmScan");
    } catch (error) {
      setError(error.message);
    }
    // La lectura es local. Solo la confirmación del número inicia la consulta.
  }
  async function logout() {
    await run(async () => {
      let remoteError;
      try {
        await request("/auth/logout", { method: "POST", token: session.token });
      } catch (error) {
        if (error.status !== 401) remoteError = error;
      }
      await SecureStore.deleteItemAsync(credentialsKey);
      setSession(null);
      setRemember(false);
      setPassword("");
      changeScreen("login");
      if (remoteError)
        setError(
          "Saliste de este dispositivo. No se pudo avisar al servidor; la sesión remota vencerá automáticamente.",
        );
    });
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Brand />
        {screen === "login" && (
          <>
            <View style={s.hero}>
              <Text style={s.eyebrow}>CONSULTA EN CAMPO</Text>
              <Text style={s.title}>Información clara. Acceso seguro.</Text>
              <Text style={s.subtitle}>
                Ingresa para consultar el estado de un ciudadano desde su
                cédula.
              </Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Iniciar sesión</Text>
              <Field
                label="Identificación"
                value={identificacion}
                onChangeText={setId}
                keyboardType="number-pad"
                maxLength={15}
                autoComplete="username"
                placeholder="Tu identificación"
              />
              <Field
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={64}
                autoComplete="current-password"
                placeholder="Tu contraseña"
              />
              <View style={s.switchRow}>
                <Text style={s.muted}>Recordar contraseña</Text>
                <Switch
                  value={remember}
                  onValueChange={async (value) => {
                    setRemember(value);
                    if (!value)
                      await SecureStore.deleteItemAsync(credentialsKey);
                  }}
                  trackColor={{ true: "#176b5b" }}
                />
              </View>
              <Button title="Ingresar →" onPress={login} disabled={busy} />
              <Button
                title="Olvidé mi contraseña"
                disabled={busy}
                secondary
                onPress={() => {
                  setRecoveryEmail("");
                  setRecoveryCode("");
                  setNewPassword("");
                  changeScreen("recover");
                }}
              />
              <Button
                title="Registrarme como personal de fuerza pública"
                onPress={openRegistration}
                disabled={busy}
                secondary
              />
            </View>
          </>
        )}
        {(screen === "recover" || screen === "reset" || changingPassword) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {changingPassword ? "Cambiar contraseña" : "Recuperar contraseña"}
            </Text>
            {screen === "changePassword" ? (
              <>
                <Field
                  label="Contraseña actual"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  maxLength={64}
                />
                <Button
                  title="Enviar código al correo"
                  disabled={busy || !currentPassword}
                  onPress={() =>
                    run(async () => {
                      await request("/auth/recuperacion/cambio/solicitar", {
                        method: "POST",
                        token: session.token,
                        body: { actual: currentPassword },
                      });
                      setCurrentPassword("");
                      changeScreen("verifyChange");
                    })
                  }
                />
              </>
            ) : screen === "recover" ? (
              <>
                <Field
                  label="Identificación"
                  value={identificacion}
                  onChangeText={setId}
                  keyboardType="number-pad"
                  maxLength={15}
                />
                <Field
                  label="Correo registrado"
                  value={recoveryEmail}
                  onChangeText={setRecoveryEmail}
                  keyboardType="email-address"
                  maxLength={150}
                />
                <Button
                  title="Solicitar código"
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      await request("/auth/recuperacion/solicitar", {
                        method: "POST",
                        body: { identificacion, correo: recoveryEmail.trim() },
                      });
                      changeScreen("reset");
                    })
                  }
                />
              </>
            ) : (
              <>
                <Text style={s.subtitle}>
                  {changingPassword
                    ? "Enviamos un código a tu correo registrado."
                    : "Si los datos coinciden, recibirás un código por correo."}
                  {" Escribe los seis dígitos. El código vence en 10 minutos."}
                </Text>
                <Field
                  label="Código de verificación"
                  value={recoveryCode}
                  onChangeText={(value) =>
                    setRecoveryCode(value.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="number-pad"
                  autoCorrect={false}
                />
                <Field
                  label="Nueva contraseña"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  maxLength={64}
                />
                <Text style={s.hint}>
                  Usa al menos 6 caracteres, una mayúscula, una minúscula y un
                  número.
                </Text>
                <Button
                  title="Cambiar contraseña"
                  disabled={
                    busy || recoveryCode.length !== 6 || newPassword.length < 6
                  }
                  onPress={() =>
                    run(async () => {
                      await request(
                        changingPassword
                          ? "/auth/recuperacion/cambio/confirmar"
                          : "/auth/recuperacion/confirmar",
                        {
                          method: "POST",
                          token: changingPassword ? session.token : undefined,
                          body: {
                            ...(changingPassword ? {} : { identificacion }),
                            codigo: recoveryCode,
                            password: newPassword,
                          },
                        },
                      );
                      await SecureStore.deleteItemAsync(credentialsKey).catch(
                        () => {},
                      );
                      setPassword("");
                      if (changingPassword) setId(session.user.identificacion);
                      setSession(null);
                      setRemember(false);
                      setRecoveryCode("");
                      setNewPassword("");
                      changeScreen("login");
                      Alert.alert(
                        "Contraseña actualizada",
                        "Ingresa con tu nueva contraseña.",
                      );
                    })
                  }
                />
                <Button
                  title="Solicitar otro código"
                  disabled={busy}
                  secondary
                  onPress={() => {
                    setRecoveryCode("");
                    setNewPassword("");
                    changeScreen(
                      changingPassword ? "changePassword" : "recover",
                    );
                  }}
                />
              </>
            )}
            <Button
              title={
                changingPassword ? "Cancelar" : "Volver al inicio de sesión"
              }
              disabled={busy}
              secondary
              onPress={() => {
                setRecoveryCode("");
                setNewPassword("");
                setCurrentPassword("");
                changeScreen(changingPassword ? "home" : "login");
              }}
            />
          </View>
        )}
        {screen === "register" && (
          <>
            <Text style={s.eyebrow}>NUEVO REGISTRO</Text>
            <Text style={s.title}>Crea tu acceso</Text>
            <Text style={s.subtitle}>
              Validaremos tus datos con el servicio de Defensa y enviaremos tu
              contraseña por correo.
            </Text>
            <View style={s.card}>
              {[
                ["identificacion", "Identificación"],
                ["nombres", "Nombres"],
                ["apellidos", "Apellidos"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={registration[key]}
                  onChangeText={(value) =>
                    setRegistration({ ...registration, [key]: value })
                  }
                  keyboardType={
                    key === "identificacion" ? "number-pad" : "default"
                  }
                  maxLength={key === "identificacion" ? 15 : 80}
                />
              ))}
              <Text style={s.label}>Fuerza pública</Text>
              <View style={s.chips}>
                {Object.keys(catalog).map((force) => (
                  <Pressable
                    key={force}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: registration.fuerza === force,
                    }}
                    style={[
                      s.chip,
                      registration.fuerza === force && s.selectedChip,
                    ]}
                    onPress={() =>
                      setRegistration({
                        ...registration,
                        fuerza: force,
                        rango: catalog[force][0],
                      })
                    }
                  >
                    <Text
                      style={
                        registration.fuerza === force
                          ? s.selectedText
                          : s.chipText
                      }
                    >
                      {force}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.label}>Rango</Text>
              <View style={s.chips}>
                {(catalog[registration.fuerza] || []).map((rank) => (
                  <Pressable
                    key={rank}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: registration.rango === rank,
                    }}
                    style={[
                      s.chip,
                      registration.rango === rank && s.selectedChip,
                    ]}
                    onPress={() =>
                      setRegistration({ ...registration, rango: rank })
                    }
                  >
                    <Text
                      style={
                        registration.rango === rank
                          ? s.selectedText
                          : s.chipText
                      }
                    >
                      {rank}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label="ID de la fuerza"
                value={registration.id_fuerza}
                onChangeText={(value) =>
                  setRegistration({ ...registration, id_fuerza: value })
                }
                maxLength={30}
              />
              <Field
                label="Correo electrónico"
                value={registration.correo}
                onChangeText={(value) =>
                  setRegistration({ ...registration, correo: value })
                }
                keyboardType="email-address"
                maxLength={150}
              />
              <Button
                title="Validar y registrarme"
                onPress={register}
                disabled={busy}
              />
              <Button
                title="Volver al inicio de sesión"
                onPress={() => changeScreen("login")}
                disabled={busy}
                secondary
              />
            </View>
          </>
        )}
        {screen === "home" && (
          <>
            <View style={s.hero}>
              <Text style={s.eyebrow}>SESIÓN INICIADA</Text>
              <Text style={s.title}>Hola, {session?.user.nombres}</Text>
              <Text style={s.subtitle}>
                Consulta el estado de un ciudadano leyendo el código de barras
                de su cédula.
              </Text>
            </View>
            <View style={s.scanCard}>
              <Text style={s.scanSymbol}>▥</Text>
              <Text style={s.cardTitle}>Consulta de antecedentes</Text>
              <Text style={s.centerText}>
                Escanea el reverso de la cédula amarilla o ingresa el número
                manualmente.
              </Text>
              <Button
                title="Escanear código de barras"
                onPress={startScan}
                disabled={
                  busy || !session?.user.permisos.includes("consulta.realizar")
                }
              />
              <Button
                title="Ingresar número manualmente"
                onPress={openManual}
                disabled={
                  busy || !session?.user.permisos.includes("consulta.realizar")
                }
                secondary
              />
            </View>
            <Text style={s.hint}>
              Cada consulta queda registrada con tu identificación, fecha y
              hora.
            </Text>
            <Button
              title="Cambiar contraseña"
              secondary
              disabled={busy}
              onPress={() => {
                setCurrentPassword("");
                setRecoveryCode("");
                setNewPassword("");
                changeScreen("changePassword");
              }}
            />
            <Button
              title="Cerrar sesión"
              onPress={logout}
              disabled={busy}
              secondary
            />
          </>
        )}
        {screen === "scan" && (
          <>
            <Text style={s.eyebrow}>LECTOR DE CÉDULAS</Text>
            <Text style={s.title}>Cédula amarilla</Text>
            <Text style={s.subtitle}>
              Coloca todo el código de barras del reverso dentro del marco.
              Mantén la cédula quieta y ajusta la distancia hasta verla nítida.
            </Text>
            <View style={s.cameraBox}>
              {permission?.granted && foreground && (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  enableTorch={torch && !scanPaused}
                  zoom={zoom}
                  barcodeScannerSettings={{
                    barcodeTypes: ["pdf417", "code128"],
                  }}
                  onBarcodeScanned={scanPaused ? undefined : onBarcode}
                  onMountError={() => {
                    scanning.current = true;
                    setScanPaused(true);
                    setTorch(false);
                    setError(
                      "No se pudo iniciar la cámara. Regresa e inténtalo nuevamente o ingresa el número manualmente.",
                    );
                  }}
                />
              )}
              <View pointerEvents="none" style={s.scanFrame} />
            </View>
            <Text style={s.hint}>
              {scanPaused
                ? "Lectura pausada. Pulsa Volver a leer para reintentar."
                : "Evita reflejos sobre el código. Si usas la luz, inclina ligeramente la cédula."}
            </Text>
            <Button
              title={torch ? "Apagar luz" : "Encender luz"}
              onPress={() => setTorch(!torch)}
              disabled={scanPaused}
              secondary
            />
            <View style={s.chips}>
              <Button
                title="Alejar"
                onPress={() => setZoom((value) => Math.max(0, value - 0.05))}
                disabled={scanPaused || zoom <= 0}
                secondary
              />
              <Button
                title="Acercar"
                onPress={() => setZoom((value) => Math.min(0.3, value + 0.05))}
                disabled={scanPaused || zoom >= 0.3}
                secondary
              />
            </View>
            <Button
              title="Volver a leer"
              onPress={() => {
                scanning.current = false;
                setScanPaused(false);
                setError("");
              }}
              disabled={busy}
              secondary
            />
            <Button
              title="Ingresar número manualmente"
              onPress={openManual}
              disabled={busy}
              secondary
            />
            <Button
              title="Cancelar"
              onPress={() => changeScreen("home")}
              disabled={busy}
              secondary
            />
          </>
        )}
        {screen === "confirmScan" && (
          <>
            <Text style={s.eyebrow}>CÉDULA LEÍDA CORRECTAMENTE</Text>
            <Text style={s.title}>Confirma el número</Text>
            <Text style={s.subtitle}>
              Compara este número con el impreso en el frente de la cédula antes
              de consultar.
            </Text>
            <View style={s.card}>
              <Text style={s.label}>Número de cédula leído</Text>
              <Text selectable style={s.cardTitle}>
                {scannedId}
              </Text>
              <Button
                title="Confirmar y consultar"
                onPress={() => consultById(scannedId)}
                disabled={busy || !scannedId}
              />
              <Button
                title="Volver a escanear"
                onPress={startScan}
                disabled={busy}
                secondary
              />
              <Button
                title="Ingresar número manualmente"
                onPress={openManual}
                disabled={busy}
                secondary
              />
              <Button
                title="Cancelar"
                onPress={() => {
                  setScannedId("");
                  changeScreen("home");
                }}
                disabled={busy}
                secondary
              />
            </View>
          </>
        )}
        {screen === "manual" && (
          <>
            <Text style={s.eyebrow}>CONSULTA MANUAL</Text>
            <Text style={s.title}>Número de documento</Text>
            <Text style={s.subtitle}>
              Ingresa el número de cédula del ciudadano cuando el código de
              barras no pueda ser leído.
            </Text>
            <View style={s.card}>
              <Field
                label="Número de identificación"
                value={manualId}
                onChangeText={(v) => setManualId(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={15}
                placeholder="Ej. 1023456789"
              />
              <Button
                title="Consultar"
                onPress={() => {
                  if (!/^\d{5,15}$/.test(manualId)) {
                    setError("Ingresa entre 5 y 15 dígitos para continuar.");
                    return;
                  }
                  consultById(manualId);
                }}
                disabled={busy || manualId.length < 5}
              />
              <Button
                title="Volver al inicio"
                onPress={() => changeScreen("home")}
                disabled={busy}
                secondary
              />
            </View>
          </>
        )}
        {screen === "result" && result && (
          <>
            <Text style={s.eyebrow}>RESULTADO DE LA CONSULTA</Text>
            <Text style={s.title}>Estado del ciudadano</Text>
            <View
              style={[
                s.result,
                result.notFound
                  ? s.neutral
                  : result.requerido
                    ? s.required
                    : s.clear,
              ]}
            >
              <Text style={s.resultIcon}>
                {result.notFound ? "?" : result.requerido ? "!" : "✓"}
              </Text>
              <Text
                style={[
                  s.resultTitle,
                  {
                    color: result.notFound
                      ? "#5e737b"
                      : result.requerido
                        ? "#a44738"
                        : "#236b49",
                  },
                ]}
              >
                {result.notFound ? "Sin registro en la base" : result.estado}
              </Text>
              <Text style={s.resultId}>CC {result.identificacion}</Text>
              <Text style={s.centerText}>
                {result.notFound
                  ? "No hay un registro activo para esta identificación."
                  : "Resultado recibido del sistema de registro."}
              </Text>
            </View>
            <Button
              title="Escanear otra cédula"
              onPress={startScan}
              disabled={busy}
            />
            <Button
              title="Ingresar número manualmente"
              onPress={openManual}
              disabled={busy}
              secondary
            />
            <Button
              title="Volver al inicio"
              onPress={() => changeScreen("home")}
              secondary
            />
          </>
        )}
        {!!error && (
          <View accessibilityRole="alert" style={s.error}>
            <Text style={s.errorText}>{error}</Text>
            {screen === "home" &&
              permission &&
              !permission.granted &&
              !permission.canAskAgain && (
                <Button
                  title="Abrir ajustes"
                  secondary
                  onPress={() => Linking.openSettings()}
                />
              )}
          </View>
        )}
        {busy && (
          <ActivityIndicator color="#176b5b" style={{ marginTop: 16 }} />
        )}
        <Text style={s.footer}>
          REGISTRADURÍA KONRAD LORENZ Demostración académica · Datos ficticios
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f7f7" },
  container: { padding: 24, paddingBottom: 30, flexGrow: 1 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 34,
  },
  brandMark: {
    backgroundColor: "#123e42",
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: { color: "#c4f2d4", fontWeight: "800", fontSize: 18 },
  brandName: { color: "#173f44", fontWeight: "700", fontSize: 18 },
  brandSub: { color: "#6f878b", fontSize: 9, letterSpacing: 2, marginTop: 4 },
  hero: { marginBottom: 24 },
  eyebrow: {
    fontSize: 10,
    color: "#176b5b",
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 31,
    color: "#173f44",
    fontWeight: "700",
    lineHeight: 37,
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    color: "#70858a",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e1e9e9",
    borderRadius: 16,
    padding: 22,
  },
  cardTitle: {
    color: "#23474b",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  field: { marginBottom: 17 },
  label: { fontSize: 12, color: "#42626a", fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d9e3e4",
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 9,
    fontSize: 14,
    color: "#153d43",
    backgroundColor: "#fff",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  muted: { fontSize: 12, color: "#658187" },
  button: {
    backgroundColor: "#176b5b",
    padding: 16,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 9,
  },
  buttonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  secondary: {
    backgroundColor: "transparent",
    borderColor: "#d7e2e2",
    borderWidth: 1,
  },
  secondaryText: { color: "#39665f" },
  disabled: { opacity: 0.45 },
  footer: {
    fontSize: 10,
    color: "#8b9ea2",
    textAlign: "center",
    marginTop: 30,
    lineHeight: 18,
    letterSpacing: 0.4,
  },
  error: {
    backgroundColor: "#fff0ec",
    padding: 15,
    borderRadius: 9,
    marginTop: 18,
  },
  errorText: { color: "#a04a3d", fontSize: 13, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 20 },
  chip: {
    padding: 10,
    borderRadius: 7,
    borderColor: "#dce6e6",
    borderWidth: 1,
  },
  selectedChip: { backgroundColor: "#176b5b", borderColor: "#176b5b" },
  selectedText: { color: "white", fontSize: 12 },
  chipText: { color: "#69858a", fontSize: 12 },
  scanCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dfe9e7",
    padding: 25,
  },
  scanSymbol: {
    fontSize: 62,
    color: "#176b5b",
    marginBottom: 18,
    textAlign: "center",
  },
  centerText: {
    fontSize: 13,
    color: "#70868a",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  hint: {
    fontSize: 12,
    color: "#8b9da1",
    textAlign: "center",
    lineHeight: 20,
    marginVertical: 19,
  },
  cameraBox: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#153e42",
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: "83%",
    height: 125,
    borderWidth: 2,
    borderColor: "#c4f2d4",
    borderRadius: 7,
  },
  result: {
    padding: 28,
    borderRadius: 17,
    alignItems: "center",
    marginVertical: 25,
    borderWidth: 1,
  },
  clear: { backgroundColor: "#e9f6ec", borderColor: "#cde7d4" },
  required: { backgroundColor: "#fff0eb", borderColor: "#f0d5cb" },
  neutral: { backgroundColor: "#edf1f4", borderColor: "#dbe2e7" },
  resultIcon: {
    fontSize: 55,
    color: "#365c5b",
    fontWeight: "600",
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 15,
  },
  resultId: { fontSize: 15, color: "#46656d", marginBottom: 20 },
});
