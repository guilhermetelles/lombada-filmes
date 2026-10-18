package io.github.guilhermetelles.lombada.notify

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.github.guilhermetelles.lombada.LombadaApplication
import io.github.guilhermetelles.lombada.MainActivity
import io.github.guilhermetelles.lombada.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Recebe os pushes do backend. Com o app fechado ou em segundo plano, o próprio sistema mostra o
 * aviso e o toque abre o `MainActivity` com os dados como extras; este serviço cuida do token novo
 * e do aviso com o app aberto, que o sistema não mostra.
 */
class LombadaMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        // Sem login, o token vai para o backend ao entrar (MainScreen).
        if (FirebaseAuth.getInstance().currentUser == null) return
        val backend = (application as LombadaApplication).container.backend
        scope.launch { DeviceRegistration(backend).registerToken(token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val notification = message.notification
        val title = notification?.title ?: data["title"] ?: return
        val body = notification?.body ?: data["body"]
        val channel = NotificationChannels.forKind(notification?.channelId ?: data["kind"])
        NotificationChannels.ensure(this)

        val target = PushTarget.parse { data[it] }
        val intent =
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                target?.listId?.let { putExtra(PushTarget.EXTRA_LIST_ID, it) }
                data[PushTarget.EXTRA_ROUTE]?.let { putExtra(PushTarget.EXTRA_ROUTE, it) }
                target?.feedId?.let { putExtra(PushTarget.EXTRA_FEED_ID, it) }
            }
        val requestCode = (target?.feedId ?: message.messageId ?: title).hashCode()
        val pending =
            PendingIntent.getActivity(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        val built =
            NotificationCompat
                .Builder(this, channel)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(ContextCompat.getColor(this, R.color.notification_accent))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(body?.let { NotificationCompat.BigTextStyle().bigText(it) })
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build()

        val granted =
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        if (!granted) return
        // A tag agrupa a atividade da outra pessoa: o aviso novo substitui o anterior.
        val tag = notification?.tag
        val id = if (tag != null) 0 else requestCode
        NotificationManagerCompat.from(this).notify(tag, id, built)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
