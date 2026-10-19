package io.github.guilhermetelles.lombada.domain

/** Nomes dos serviços de streaming como o TMDb manda, sem as variantes repetidas. */
object StreamingServices {
    private val channelSuffix = Regex("\\s+amazon\\s+channel$", RegexOption.IGNORE_CASE)
    private val plusWord = Regex("\\s+plus\\b", RegexOption.IGNORE_CASE)
    private val spaces = Regex("\\s+")

    /**
     * Tira as variantes do mesmo serviço: "… Amazon Channel" some quando o serviço base também está
     * na lista, e "Paramount Plus" conta como "Paramount+" (fica o primeiro que aparece).
     *
     * @param services Nomes, na ordem do TMDb.
     * @return Os nomes sem repetição, na mesma ordem.
     */
    fun unify(services: List<String>): List<String> {
        val names = services.map { it.trim() }.filter { it.isNotEmpty() }
        val bases = names.filterNot { channelSuffix.containsMatchIn(it) }.map(::key).toSet()
        val seen = mutableSetOf<String>()
        return names.filter { name ->
            val isChannel = channelSuffix.containsMatchIn(name)
            val base = key(channelSuffix.replace(name, ""))
            when {
                isChannel && base in bases -> false
                else -> seen.add(if (isChannel) "$base#channel" else base)
            }
        }
    }

    private fun key(name: String): String = spaces.replace(plusWord.replace(name.lowercase(), "+"), "")
}
