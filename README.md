# Todoofus

You either die a hero, or live long enough to build a todo app.

I basically just wanted a todo list that creates the todos in a tree format.
This makes the most sense to my brain so... I did it.

The idea is that I create a todo, then to complete that todo there may be a
bunch of smaller things that need completing so I can create sub-todos for the
todo.

This uses Rust on the backend with a sqlite DB. I only intend to use it for my
own personal usecase so there is no security, no users. Just a simple web app
and a DB to store the data.

I wrote the frontend using only vanilla HTML, CSS and JS just to see how far I
can get without a framework. I figured this was a good exercise given the
simplicity of this project.

This runs on port 3000 inside the container and creates the database in the same
directory as the executable under ./data

To build:

```bash
sudo docker build -t todoofus .
```

To run:

```bash
sudo docker run -it --rm \
  -v $(pwd)/data/todoofus/:/usr/src/app/data/ \
  todoofus
```
