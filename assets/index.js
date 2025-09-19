const todoTemplate = document.getElementById("todo-template");
const todoFormTemplate = document.getElementById("todo-form-template");
const todoEditFormTemplate = document.getElementById("todo-edit-form-template");

const DOUBLE_CLICK_DELAY = 200; // milliseconds

window.addEventListener("load", async () => {
  let todos;
  try {
    const response = await fetch("/todos");
    todos = await response.json();
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const todo_container = document.getElementById("all-todos");
  for (const todo of todos) {
    const todoElement = createTodoTree(
      todo.id,
      todo.description,
      todo.completed,
      todo.children,
    );

    todo_container.appendChild(todoElement);
  }
  adjustLineHeights();
});

// Places the form immediately after the refNode
function newTodoForm(refNode) {
  let parentId = "";
  if (refNode.id != "dummy-first-todo") {
    parentId = refNode.querySelector("input[name='id']").value;
  }

  const template = todoFormTemplate.content.cloneNode(true);
  template.querySelector("input[name='parent_id']").value = parentId;
  refNode.after(template);
  const descriptionInput = refNode.nextElementSibling.querySelector(
    "input[name='description']",
  );
  descriptionInput.focus(); // Focus for immediate typing
}

function removeTodoForm(formElement) {
  formElement.remove();
  adjustLineHeights();
}

function createTodoElement(id, todoDescription, todoCompleted) {
  const newTodo = todoTemplate.content.cloneNode(true);

  newTodo.querySelector(".todo-description").innerHTML =
    markdownLinksToHtml(todoDescription);

  newTodo.querySelector("input[name='id']").value = id;
  newTodo.querySelector(".todo-checkbox").checked = todoCompleted;

  const content = newTodo.querySelector(".todo-contents");

  let clickTimer = null;
  content.addEventListener("click", (event) => {
    console.log(event.target.tagName);
    const clickedTagName = event.target.tagName.toLowerCase();
    if (clickedTagName === "a" || clickedTagName === "input") {
      return; // We want to still allow clicking anchor tags and clicking checkbox
    }

    if (clickTimer != null) {
      // This was a double click
      clearTimeout(clickTimer);
      clickTimer = null;

      console.log("Double Click");
      newTodoForm(event.target.closest(".todo-item").parentNode); // On double click we create a new todo
      return;
    }

    clickTimer = setTimeout(() => {
      // Single click
      clickTimer = null;

      console.log("Single Click");
      newEditTodoForm(event.target.closest(".todo-item")); // On single click we edit the current todo
    }, DOUBLE_CLICK_DELAY);
  });

  return newTodo;
}

function createTodoTree(id, todoDescription, todoCompleted, childTodos) {
  const todoTreeRoot = document.createElement("ul");

  const listItem = document.createElement("li");
  const newTodo = createTodoElement(id, todoDescription, todoCompleted);
  listItem.appendChild(newTodo);
  todoTreeRoot.appendChild(listItem);

  for (child of childTodos) {
    todoTreeRoot.appendChild(
      createTodoTree(
        child.id,
        child.description,
        child.completed,
        child.children,
      ),
    );
  }

  return todoTreeRoot;
}

async function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  let parentId = parseInt(
    submittedForm.querySelector("input[name='parent_id']").value,
  );
  parentId = isNaN(parentId) ? undefined : parentId; // If the value is empty then set it to undefined

  const todoDescription = submittedForm.querySelector(
    ".todo-description-input",
  ).value;

  let newTodoId = undefined;
  try {
    const response = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: todoDescription,
        parentId: parentId,
      }),
    });

    const json_resp = await response.json();
    newTodoId = json_resp.id;
    console.log("Created new Todo with ID: ", newTodoId);
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const newTodo = createTodoTree(newTodoId, todoDescription, false, []);
  submittedForm.closest(".todo-form").replaceWith(newTodo);

  adjustLineHeights();
}

function getChildrenTodoItems(parentTodo) {
  const parentUL = parentTodo.parentElement.parentElement; // The todo item is in a li, which must also be in a ul
  return parentUL.querySelectorAll(".todo-item");
}

async function toggleTodoItemRecursively(parentTodo) {
  const checked = parentTodo.querySelector(".todo-checkbox").checked;
  const childTodos = getChildrenTodoItems(parentTodo);

  const todoToUpdate = [];
  for (const child of childTodos) {
    todoToUpdate.push({
      id: parseInt(child.querySelector("input[name='id']").value),
      completed: checked,
    });
  }

  try {
    const response = await fetch("/todos/completed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todoToUpdate),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log("Updated todos with", todoToUpdate);
  } catch (e) {
    console.error("Failed to update Todo items: ", e);
    return;
  }

  for (const child of childTodos) {
    child.querySelector(".todo-checkbox").checked = checked;
  }
}

function newEditTodoForm(todoElement) {
  const editForm = todoEditFormTemplate.content.cloneNode(true);

  const todoDescription = htmlLinksToMarkdown(
    todoElement.querySelector(".todo-description").innerHTML,
  );
  const todoID = todoElement.querySelector("input[name='id']").value;

  const descriptionInput = editForm.querySelector("input[name='description']");
  descriptionInput.value = todoDescription;
  editForm.querySelector("input[name='id']").value = todoID;

  todoElement.replaceWith(editForm);
  // Focus the description input and move cursor to the end
  descriptionInput.focus();
  if (descriptionInput.setSelectionRange) {
    const length = descriptionInput.value.length;
    descriptionInput.setSelectionRange(length, length);
  }
}

async function editTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;

  const newDescription = submittedForm.querySelector(
    "input[name='description']",
  ).value;

  const todoID = parseInt(
    submittedForm.querySelector("input[name='id']").value,
  );

  // Send to DB
  let todo_json;
  try {
    const response = await fetch("/todos/description", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID, description: newDescription }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }

    todo_json = await response.json();
    console.log(
      `Updated todo ${todo_json.id} with new description ${todo_json.description}`,
    );
  } catch (e) {
    console.error("Failed to update Todo description: ", e);
    return;
  }

  // Update DOM
  const newTodo = createTodoElement(
    todo_json.id,
    todo_json.description,
    todo_json.completed,
  );

  submittedForm.replaceWith(newTodo);

  adjustLineHeights();
}

async function deleteTodo(todoItem) {
  if (!confirm("Are you sure?")) {
    return;
  }

  const todoID = parseInt(todoItem.querySelector("input[name='id']").value);

  // Send to DB
  try {
    const response = await fetch("/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log(`Deleted todo ${todoID}`);
  } catch (e) {
    console.error("Failed to delete Todo: ", e);
    return;
  }

  // Update DOM
  const treeUL = todoItem.parentElement.parentElement;
  treeUL.remove();

  adjustLineHeights();
}

function adjustLineHeights() {
  const lis = document.querySelectorAll("ul ul li");
  for (const curr of lis) {
    const sibCheckbox =
      curr.parentElement.previousElementSibling.querySelector(".todo-checkbox");
    if (sibCheckbox == null) {
      continue;
    }

    const currRect = curr.getBoundingClientRect();
    const currY = currRect.top + currRect.height / 2;
    const currHeight = currRect.height;

    const sibRect = sibCheckbox.getBoundingClientRect();

    const lineHeight = currY - sibRect.top - 5;

    curr.style.setProperty("--line-height", `${lineHeight}px`);
    curr.style.setProperty("--top-shift", `-${lineHeight - currHeight / 2}px`);
  }
}

function markdownLinksToHtml(text) {
  return text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}
function htmlLinksToMarkdown(html) {
  return html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)");
}

// TODO: checked nodes sorted to the bottom of the ul they are in, when unchecked move them back into the unchecked section
