workspace {
    model {
        user = person "User"
        softwareSystem = softwareSystem "Software System" {
            user -> this "Uses"
        }
    }
    views {
        systemContext softwareSystem {
            include *
            autolayout lr
        }
    }
}