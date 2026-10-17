# Regras do R8 para a versão. As bibliotecas (Firebase, Retrofit, OkHttp, kotlinx.serialization,
# Coil, Navigation) trazem as próprias; aqui fica só o que é do app.

# Rotas da navegação e corpos do backend são lidos por nome pelo kotlinx.serialization.
-keep @kotlinx.serialization.Serializable class io.github.guilhermetelles.lombada.** { *; }
